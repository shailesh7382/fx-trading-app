import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  IconButton,
  InputBase,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { amendLimitOrder, cancelLimitOrder, extractApiMessage, fetchFxGrid, submitLimitOrder } from '../api/client';
import UserContext from './UserContext';
import { calculateSettlementDate, formatDateTime, formatNotional, formatRate, getCurrencyCodes, getRateDisplayParts } from '../utils/formatters';

const flashDurationMs = 900;
const tenorOrder = ['SP', '1W', '1M', '6M', '1Y', '3M'];

function getRateSignal(currentValue, previousValue) {
  if (previousValue == null || currentValue === previousValue) {
    return null;
  }

  return currentValue > previousValue ? 'up' : 'down';
}

function getQuoteTileStyles(baseBackground, signal) {
  const signalStyles =
    signal === 'up'
      ? {
          borderColor: 'rgba(43, 213, 118, 0.55)',
          boxShadow: '0 0 0 1px rgba(43, 213, 118, 0.22), 0 0 18px rgba(43, 213, 118, 0.14)',
          transform: 'translateY(-1px)',
        }
      : signal === 'down'
        ? {
            borderColor: 'rgba(255, 107, 129, 0.55)',
            boxShadow: '0 0 0 1px rgba(255, 107, 129, 0.22), 0 0 18px rgba(255, 107, 129, 0.14)',
            transform: 'translateY(-1px)',
          }
        : {};

  return {
    p: 0.8,
    borderRadius: 0.75,
    bgcolor: baseBackground,
    border: '1px solid transparent',
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
    ...signalStyles,
  };
}

function getTenorSortOrder(tenor) {
  const index = tenorOrder.indexOf(tenor);
  return index === -1 ? tenorOrder.length : index;
}

function sanitizeQuantityInput(value = '') {
  return String(value).replace(/[^\d]/g, '');
}

function formatDealQuantity(value) {
  const digits = sanitizeQuantityInput(value);

  if (!digits) {
    return '';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

function getInitialDealQuantity(rate) {
  const roundedQuantity = Math.round(Number(rate?.qty || 0));

  if (!roundedQuantity) {
    return '1000000';
  }

  return String(roundedQuantity);
}

function getInitialLimitPrice(direction, rate) {
  if (!rate) {
    return '';
  }

  return String(direction === 'Sell' ? rate.bid : rate.ask);
}

function getDefaultGoodTillDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialLimitOrderForm(rate, selection) {
  return {
    ccyPair: selection?.ccyPair || rate?.ccyPair || '',
    tenor: selection?.tenor || rate?.tenor || 'SP',
    direction: 'Buy',
    limitPrice: getInitialLimitPrice('Buy', rate),
    timeInForce: 'GTC',
    goodTillDate: getDefaultGoodTillDate(),
  };
}

function buildAmendOrderForm(order) {
  return {
    qty: String(Math.round(Number(order?.qty || 0))),
    limitPrice: String(order?.limitPrice || ''),
    timeInForce: order?.timeInForce || 'GTC',
    goodTillDate: order?.goodTillDate || getDefaultGoodTillDate(),
    comments: order?.comments || '',
  };
}

function RateDisplay({ value, accentColor }) {
  const { major, significant, pipette } = getRateDisplayParts(value);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: { xs: '0.82rem', md: '0.92rem' }, fontWeight: 500, color: 'text.secondary', mt: 0.4 }}
      >
        {major}
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: { xs: '1.95rem', md: '2.45rem' }, fontWeight: 800, letterSpacing: '0.01em', color: accentColor }}
      >
        {significant}
      </Typography>
      {pipette ? (
        <Typography component="span" sx={{ fontSize: { xs: '0.72rem', md: '0.84rem' }, fontWeight: 700, mt: 0.34, color: 'text.secondary' }}>
          {pipette}
        </Typography>
      ) : null}
    </Box>
  );
}

function FXRateGrid() {
  const navigate = useNavigate();
  const { userDetails } = useContext(UserContext);
  const {
    rates,
    error,
    isLoading,
    lastUpdated,
    limitOrders = [],
    refresh,
    isRatesStreaming = false,
    setRatesStreaming = () => {},
  } = useOutletContext();
  const maxVisibleRates = 6;
  const [serverRates, setServerRates] = useState([]);
  const [gridRequestFailed, setGridRequestFailed] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [manualGridRefreshVersion, setManualGridRefreshVersion] = useState(0);
  const previousRatesRef = useRef(new Map());
  const selectionSeedRef = useRef({ search: '', sortBy: 'pair' });
  const [flashSignals, setFlashSignals] = useState({});
  const [cardSelections, setCardSelections] = useState([]);
  const [dealCurrencies, setDealCurrencies] = useState([]);
  const [dealQuantities, setDealQuantities] = useState([]);
  const [editingQuantityIndex, setEditingQuantityIndex] = useState(null);
  const [limitOrderForms, setLimitOrderForms] = useState([]);
  const [submittingLimitIndex, setSubmittingLimitIndex] = useState(null);
  const [limitOrderFeedback, setLimitOrderFeedback] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [amendOrderForm, setAmendOrderForm] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [processingOrderAction, setProcessingOrderAction] = useState('');

  const displayRates = useMemo(() => {
    const grouped = new Map();

    rates.forEach((rate) => {
      const key = `${rate.ccyPair}|${rate.tenor}`;
      const existing = grouped.get(key);
      const existingUpdatedAt = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const nextUpdatedAt = rate?.updatedAt ? new Date(rate.updatedAt).getTime() : 0;

      if (!existing || nextUpdatedAt > existingUpdatedAt || (nextUpdatedAt === existingUpdatedAt && Number(rate.qty || 0) > Number(existing.qty || 0))) {
        grouped.set(key, rate);
      }
    });

    return [...grouped.values()].sort((left, right) => {
      const pairOrder = left.ccyPair.localeCompare(right.ccyPair);
      if (pairOrder !== 0) {
        return pairOrder;
      }

      return getTenorSortOrder(left.tenor) - getTenorSortOrder(right.tenor) || left.tenor.localeCompare(right.tenor);
    });
  }, [rates]);

  const quoteLookup = useMemo(
    () => new Map(displayRates.map((rate) => [`${rate.ccyPair}|${rate.tenor}`, rate])),
    [displayRates]
  );

  const pairOptions = useMemo(() => [...new Set(displayRates.map((rate) => rate.ccyPair))], [displayRates]);

  const tenorsByPair = useMemo(() => {
    const tenorMap = new Map();

    displayRates.forEach((rate) => {
      const currentTenors = tenorMap.get(rate.ccyPair) || [];
      if (!currentTenors.includes(rate.tenor)) {
        currentTenors.push(rate.tenor);
      }
      currentTenors.sort((left, right) => getTenorSortOrder(left) - getTenorSortOrder(right) || left.localeCompare(right));
      tenorMap.set(rate.ccyPair, currentTenors);
    });

    return tenorMap;
  }, [displayRates]);

  const fallbackRates = useMemo(() => {
    return [...rates]
      .sort((left, right) => {
        return left.ccyPair.localeCompare(right.ccyPair);
      });
  }, [rates]);

  const gridRefreshToken = isRatesStreaming ? lastUpdated : manualGridRefreshVersion;

  useEffect(() => {
    let isMounted = true;
    let loadTimer;

    async function loadGridRates() {
      setIsGridLoading(true);

      try {
        const data = await fetchFxGrid({
          limit: maxVisibleRates,
        });

        if (!isMounted) {
          return;
        }

        setServerRates(data);
        setGridRequestFailed(false);
      } catch (gridError) {
        if (!isMounted) {
          return;
        }

        setServerRates([]);
        setGridRequestFailed(true);
      } finally {
        if (isMounted) {
          setIsGridLoading(false);
        }
      }
    }

    loadTimer = window.setTimeout(loadGridRates, 120);

    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
    };
  }, [gridRefreshToken, maxVisibleRates]);

  const visibleRates = gridRequestFailed ? fallbackRates.slice(0, maxVisibleRates) : serverRates;

  useEffect(() => {
    const queryChanged = false;
    selectionSeedRef.current = { search: '', sortBy: 'pair' };

    setCardSelections((previousSelections) => {
      const defaultSelections = visibleRates.map((rate) => ({
        ccyPair: rate.ccyPair,
        tenor: rate.tenor,
      }));

      if (!defaultSelections.length) {
        return [];
      }

      if (queryChanged || !previousSelections.length || previousSelections.length !== defaultSelections.length) {
        return defaultSelections;
      }

      return defaultSelections.map((fallbackSelection, index) => {
        const previousSelection = previousSelections[index];
        if (!previousSelection) {
          return fallbackSelection;
        }

        const exactKey = `${previousSelection.ccyPair}|${previousSelection.tenor}`;
        if (quoteLookup.has(exactKey)) {
          return previousSelection;
        }

        const availableTenors = tenorsByPair.get(previousSelection.ccyPair);
        if (availableTenors?.length) {
          return {
            ccyPair: previousSelection.ccyPair,
            tenor: availableTenors[0],
          };
        }

        return fallbackSelection;
      });
    });
  }, [quoteLookup, tenorsByPair, visibleRates]);

  const displayedCards = useMemo(
    () =>
      cardSelections
        .map((selection, index) => {
          const selectedQuote = quoteLookup.get(`${selection.ccyPair}|${selection.tenor}`);
          return {
            selection,
            quote: selectedQuote || visibleRates[index],
            index,
          };
        })
        .filter((card) => Boolean(card.quote)),
    [cardSelections, quoteLookup, visibleRates]
  );

  useEffect(() => {
    setDealCurrencies((previousSelections) =>
      displayedCards.map((card, index) => {
        const { base, terms } = getCurrencyCodes(card.selection.ccyPair);
        const previousSelection = previousSelections[index];

        if (previousSelection === base || previousSelection === terms) {
          return previousSelection;
        }

        return base;
      })
    );
  }, [displayedCards]);

  useEffect(() => {
    setDealQuantities((previousSelections) =>
      displayedCards.map((card, index) => {
        const previousSelection = sanitizeQuantityInput(previousSelections[index]);

        if (previousSelection) {
          return previousSelection;
        }

        return getInitialDealQuantity(card.quote);
      })
    );
  }, [displayedCards]);

  useEffect(() => {
    setLimitOrderForms((previousForms) =>
      displayedCards.map((card, index) => {
        const previousForm = previousForms[index];

        if (previousForm && previousForm.ccyPair === card.selection.ccyPair && previousForm.tenor === card.selection.tenor) {
          return previousForm;
        }

        return buildInitialLimitOrderForm(card.quote, card.selection);
      })
    );
  }, [displayedCards]);

  useEffect(() => {
    if (editingQuantityIndex == null || editingQuantityIndex < displayedCards.length) {
      return;
    }

    setEditingQuantityIndex(null);
  }, [displayedCards.length, editingQuantityIndex]);

  useEffect(() => {
    const nextSignals = {};

    visibleRates.forEach((rate) => {
      const key = `${rate.ccyPair}-${rate.tenor}`;
      const previous = previousRatesRef.current.get(key);
      const bidSignal = getRateSignal(rate.bid, previous?.bid);
      const askSignal = getRateSignal(rate.ask, previous?.ask);

      if (bidSignal || askSignal) {
        nextSignals[key] = {
          bid: bidSignal,
          ask: askSignal,
        };
      }
    });

    previousRatesRef.current = new Map(
      visibleRates.map((rate) => [`${rate.ccyPair}-${rate.tenor}`, { bid: rate.bid, ask: rate.ask }])
    );

    if (!Object.keys(nextSignals).length) {
      return undefined;
    }

    setFlashSignals(nextSignals);

    const clearTimer = window.setTimeout(() => {
      setFlashSignals({});
    }, flashDurationMs);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [visibleRates]);

  const handlePairChange = (cardIndex, ccyPair) => {
    const nextTenors = tenorsByPair.get(ccyPair) || [];
    const nextTenor = nextTenors[0] || 'SP';

    setCardSelections((previousSelections) =>
      previousSelections.map((selection, index) =>
        index === cardIndex
          ? {
              ccyPair,
              tenor: nextTenor,
            }
          : selection
      )
    );
  };

  const handleTenorChange = (cardIndex, tenor) => {
    setCardSelections((previousSelections) =>
      previousSelections.map((selection, index) =>
        index === cardIndex
          ? {
              ...selection,
              tenor,
            }
          : selection
      )
    );
  };

  const toggleDealCurrency = (cardIndex, base, terms) => {
    if (!base || !terms) {
      return;
    }

    setDealCurrencies((previousSelections) =>
      previousSelections.map((selection, index) => (index === cardIndex ? (selection === terms ? base : terms) : selection))
    );
  };

  const handleDealQuantityChange = (cardIndex, value) => {
    const nextValue = sanitizeQuantityInput(value);

    setDealQuantities((previousSelections) => previousSelections.map((selection, index) => (index === cardIndex ? nextValue : selection)));
  };

  const handleLimitOrderFieldChange = (cardIndex, field, value, rate, selection) => {
    setLimitOrderForms((previousForms) =>
      previousForms.map((form, index) => {
        if (index !== cardIndex) {
          return form;
        }

        if (field === 'direction') {
          return {
            ...form,
            ccyPair: selection.ccyPair,
            tenor: selection.tenor,
            direction: value,
            limitPrice: getInitialLimitPrice(value, rate),
          };
        }

        if (field === 'timeInForce') {
          return {
            ...form,
            ccyPair: selection.ccyPair,
            tenor: selection.tenor,
            timeInForce: value,
            goodTillDate: getDefaultGoodTillDate(),
          };
        }

        return {
          ...form,
          ccyPair: selection.ccyPair,
          tenor: selection.tenor,
          [field]: value,
        };
      })
    );
  };

  const activeLimitOrders = useMemo(
    () => (Array.isArray(limitOrders) ? limitOrders.filter((order) => order?.status === 'ACTIVE') : []),
    [limitOrders]
  );

  const handleSubmitLimitOrder = async ({ cardIndex, form, selection, dealtCurrency, qty, settlementDate }) => {
    if (selection.tenor !== 'SP') {
      setLimitOrderFeedback({ severity: 'info', message: 'Limit orders are available for spot cards only.' });
      return;
    }

    const parsedQty = Number.parseInt(qty, 10);
    const parsedLimitPrice = Number(form.limitPrice);

    if (!parsedQty) {
      setLimitOrderFeedback({ severity: 'error', message: 'Enter a valid quantity before submitting a limit order.' });
      return;
    }

    if (!parsedLimitPrice) {
      setLimitOrderFeedback({ severity: 'error', message: 'Enter a valid limit price before submitting a limit order.' });
      return;
    }

    setSubmittingLimitIndex(cardIndex);

    try {
      const submittedOrder = await submitLimitOrder({
        ccyPair: selection.ccyPair,
        tenor: selection.tenor,
        qty: parsedQty,
        direction: form.direction,
        dealtCurrency: dealtCurrency,
        limitPrice: parsedLimitPrice,
        timeInForce: form.timeInForce,
        goodTillDate: form.timeInForce === 'GTD' ? form.goodTillDate : null,
        tradeDate: new Date().toISOString().slice(0, 10),
        settlementDate,
        trader: userDetails?.username || 'demo.trader',
      });

      setLimitOrderFeedback({
        severity: 'success',
        message: `Limit order ${submittedOrder.id} submitted for ${submittedOrder.direction} ${submittedOrder.ccyPair}.`,
      });

      await refresh?.();
    } catch (submitError) {
      setLimitOrderFeedback({
        severity: 'error',
        message: extractApiMessage(submitError, 'Unable to submit the limit order right now.'),
      });
    } finally {
      setSubmittingLimitIndex(null);
    }
  };

  const startAmendOrder = (order) => {
    setEditingOrderId(order.id);
    setAmendOrderForm(buildAmendOrderForm(order));
  };

  const handleAmendOrderFieldChange = (field, value) => {
    setAmendOrderForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const resetAmendOrder = () => {
    setEditingOrderId(null);
    setAmendOrderForm(null);
  };

  const handleSaveAmendOrder = async (order) => {
    const parsedQty = Number.parseInt(amendOrderForm?.qty || '', 10);
    const parsedLimitPrice = Number(amendOrderForm?.limitPrice || 0);

    if (!parsedQty) {
      setLimitOrderFeedback({ severity: 'error', message: 'Enter a valid amended quantity before saving.' });
      return;
    }

    if (!parsedLimitPrice) {
      setLimitOrderFeedback({ severity: 'error', message: 'Enter a valid amended limit price before saving.' });
      return;
    }

    setProcessingOrderId(order.id);
    setProcessingOrderAction('amend');

    try {
      const updatedOrder = await amendLimitOrder(order.id, {
        qty: parsedQty,
        limitPrice: parsedLimitPrice,
        timeInForce: amendOrderForm.timeInForce,
        goodTillDate: amendOrderForm.timeInForce === 'GTD' ? amendOrderForm.goodTillDate : null,
        comments: amendOrderForm.comments,
      });

      setLimitOrderFeedback({
        severity: 'success',
        message:
          updatedOrder.status === 'EXECUTED'
            ? `Limit order ${updatedOrder.id} was amended and immediately executed.`
            : `Limit order ${updatedOrder.id} amended successfully.`,
      });
      resetAmendOrder();
      await refresh?.();
    } catch (amendError) {
      setLimitOrderFeedback({
        severity: 'error',
        message: extractApiMessage(amendError, 'Unable to amend the limit order right now.'),
      });
    } finally {
      setProcessingOrderId(null);
      setProcessingOrderAction('');
    }
  };

  const handleCancelOrder = async (order) => {
    setProcessingOrderId(order.id);
    setProcessingOrderAction('cancel');

    try {
      const cancelledOrder = await cancelLimitOrder(order.id);
      setLimitOrderFeedback({
        severity: 'success',
        message: `Limit order ${cancelledOrder.id} cancelled successfully.`,
      });

      if (editingOrderId === order.id) {
        resetAmendOrder();
      }

      await refresh?.();
    } catch (cancelError) {
      setLimitOrderFeedback({
        severity: 'error',
        message: extractApiMessage(cancelError, 'Unable to cancel the limit order right now.'),
      });
    } finally {
      setProcessingOrderId(null);
      setProcessingOrderAction('');
    }
  };

  const buildBookingState = (rate, direction, dealtCurrency, valueDate, qty) => ({
    quote: rate,
    direction,
    dealtCurrency,
    valueDate,
    qty,
  });

  const handleRatesModeToggle = async (event) => {
    const nextStreamingState = event.target.checked;
    setRatesStreaming(nextStreamingState);

    if (!nextStreamingState) {
      setLimitOrderFeedback({ severity: 'info', message: 'Manual RFQ mode enabled. ' });
      return;
    }

    setLimitOrderFeedback({ severity: 'info', message: 'Live streaming enabled.' });
    await refresh?.({ forceRates: true });
  };

  const handleManualRatesRefresh = async () => {
    await refresh?.({ forceRates: true });
    setManualGridRefreshVersion((currentValue) => currentValue + 1);
  };

  return (
    <Stack spacing={2.25}>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {limitOrderFeedback ? <Alert severity={limitOrderFeedback.severity}>{limitOrderFeedback.message}</Alert> : null}

      <Paper sx={{ p: 1.35 }}>
        <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Manual RFQ controls
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0, flexWrap: 'nowrap' }}>
            <FormControlLabel
              control={<Switch checked={isRatesStreaming} onChange={handleRatesModeToggle} />}
              label={isRatesStreaming ? 'Live streaming' : 'RFQ'}
              sx={{ mr: 0, whiteSpace: 'nowrap', '& .MuiFormControlLabel-label': { fontSize: '0.84rem', fontWeight: 600 } }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<SyncRoundedIcon fontSize="small" />}
              onClick={handleManualRatesRefresh}
              disabled={isLoading || isGridLoading}
              sx={{
                minWidth: 118,
                height: 34,
                px: 1.35,
                fontSize: '0.76rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                borderColor: 'rgba(143, 189, 232, 0.24)',
                bgcolor: 'rgba(255,255,255,0.03)',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'rgba(143, 189, 232, 0.38)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1.2,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.85fr) minmax(280px, 0.72fr)' },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {displayedCards.map(({ quote: rate, selection, index }) => {
            const { base, terms } = getCurrencyCodes(selection.ccyPair);
            const valueDate = calculateSettlementDate(new Date().toISOString(), selection.tenor);
            const selectedDealCurrency = dealCurrencies[index] || base;
            const selectedDealQuantity = dealQuantities[index] || getInitialDealQuantity(rate);
            const bookingQuantity = Number.parseInt(selectedDealQuantity, 10) || Number.parseInt(getInitialDealQuantity(rate), 10);
            const nextDealCurrency = selectedDealCurrency === base ? terms : base;
            const limitOrderForm = limitOrderForms[index] || buildInitialLimitOrderForm(rate, selection);
            const isSpotCard = selection.tenor === 'SP';

            return (
              <Card key={`${selection.ccyPair}-${selection.tenor}-${index}`} sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: { xs: 1.15, md: 1.25 }, '&:last-child': { pb: { xs: 1.15, md: 1.25 } } }}>
                  <Stack spacing={1.1}>
                    <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={0.5} sx={{ width: '100%', flexWrap: 'wrap' }}>
                        <TextField
                          select
                          size="small"
                          value={selection.ccyPair}
                          onChange={(event) => handlePairChange(index, event.target.value)}
                          sx={{
                            minWidth: 128,
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 0.45,
                              bgcolor: 'rgba(255,255,255,0.02)',
                            },
                            '& .MuiSelect-select': {
                              py: 0.45,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                            },
                          }}
                        >
                          {pairOptions.map((pairOption) => (
                            <MenuItem key={pairOption} value={pairOption}>
                              {pairOption}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          size="small"
                          value={selection.tenor}
                          onChange={(event) => handleTenorChange(index, event.target.value)}
                          sx={{
                            width: 78,
                            flexShrink: 0,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 0.45,
                              bgcolor: 'rgba(255,255,255,0.02)',
                            },
                            '& .MuiSelect-select': {
                              py: 0.45,
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textAlign: 'center',
                            },
                          }}
                        >
                          {(tenorsByPair.get(selection.ccyPair) || [selection.tenor]).map((tenorOption) => (
                            <MenuItem key={tenorOption} value={tenorOption}>
                              {tenorOption}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    </Stack>

                    <Box sx={{ display: 'grid', gap: 0.8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <Paper sx={getQuoteTileStyles('rgba(255, 107, 129, 0.08)', flashSignals[`${rate.ccyPair}-${rate.tenor}`]?.bid)}>
                        <RateDisplay value={rate.bid} accentColor="error.main" />
                        <Button
                          fullWidth
                          color="error"
                          variant="outlined"
                          sx={{ mt: 0.75, minHeight: 30, fontWeight: 700, fontSize: '0.74rem', py: 0.3 }}
                          onClick={() =>
                            navigate('/app/booking', {
                              state: buildBookingState(rate, 'Sell', selectedDealCurrency, valueDate, bookingQuantity),
                            })
                          }
                        >
                          Sell
                        </Button>
                      </Paper>

                      <Paper sx={getQuoteTileStyles('rgba(43, 213, 118, 0.08)', flashSignals[`${rate.ccyPair}-${rate.tenor}`]?.ask)}>
                        <RateDisplay value={rate.ask} accentColor="success.main" />
                        <Button
                          fullWidth
                          color="success"
                          variant="outlined"
                          sx={{ mt: 0.75, minHeight: 30, fontWeight: 700, fontSize: '0.74rem', py: 0.3 }}
                          onClick={() =>
                            navigate('/app/booking', {
                              state: buildBookingState(rate, 'Buy', selectedDealCurrency, valueDate, bookingQuantity),
                            })
                          }
                        >
                          Buy
                        </Button>
                      </Paper>
                    </Box>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 0.55,
                        borderRadius: 0.75,
                        borderColor: 'rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}
                      >
                        <Box
                          sx={{
                              display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                            px: 0.55,
                            py: 0.2,
                            borderRadius: 0.6,
                            border: '1px solid rgba(255,255,255,0.08)',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            minWidth: 0,
                            flex: '1 1 auto',
                          }}
                        >
                          <InputBase
                            value={editingQuantityIndex === index ? selectedDealQuantity : formatDealQuantity(selectedDealQuantity)}
                            onChange={(event) => handleDealQuantityChange(index, event.target.value)}
                            onFocus={(event) => {
                              setEditingQuantityIndex(index);
                              event.target.select();
                            }}
                            onBlur={() => {
                              setEditingQuantityIndex((currentIndex) => (currentIndex === index ? null : currentIndex));
                            }}
                            inputProps={{
                              'aria-label': `${selection.ccyPair} quantity`,
                              inputMode: 'numeric',
                              pattern: '[0-9,]*',
                            }}
                            sx={{
                              flex: '0 1 112px',
                              minWidth: 72,
                              fontWeight: 700,
                              fontSize: '0.76rem',
                              fontVariantNumeric: 'tabular-nums',
                              '& input': {
                                p: 0,
                                textAlign: 'right',
                              },
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: '0.02em', fontSize: '0.72rem' }}>
                            {selectedDealCurrency}
                          </Typography>
                          <Tooltip title={nextDealCurrency ? `Toggle dealt currency to ${nextDealCurrency}` : 'Only one currency available'}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => toggleDealCurrency(index, base, terms)}
                                disabled={!nextDealCurrency}
                                aria-label={nextDealCurrency ? `Toggle dealt currency to ${nextDealCurrency}` : 'Only one currency available'}
                                sx={{ color: 'text.secondary' }}
                              >
                                <SwapHorizRoundedIcon fontSize="inherit" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>

                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, whiteSpace: 'nowrap', ml: 'auto', fontSize: '0.72rem' }}>
                          {valueDate}
                        </Typography>
                      </Stack>
                    </Paper>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 0.8,
                        borderRadius: 0.75,
                        borderColor: 'rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <Stack spacing={0.85}>

                        {isSpotCard ? (
                          <>


                            <Box
                              sx={{
                                display: 'grid',
                                gap: 0.8,
                                gridTemplateColumns: '76px minmax(0, 1fr)',
                                alignItems: 'start',
                              }}
                            >
                              <TextField
                                select
                                size="small"
                                value={limitOrderForm.direction}
                                onChange={(event) => handleLimitOrderFieldChange(index, 'direction', event.target.value, rate, selection)}
                                slotProps={{
                                  select: { displayEmpty: true },
                                  htmlInput: { 'aria-label': `${selection.ccyPair} limit order side` },
                                }}
                                sx={{
                                  '& .MuiInputBase-root': {
                                    minHeight: 30,
                                    bgcolor: 'rgba(255,255,255,0.035)',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                  },
                                  '& .MuiSelect-select': {
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    py: 0.62,
                                  },
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.2,
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.12)',
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.18)',
                                  },
                                }}
                              >
                                <MenuItem value="Buy">Buy</MenuItem>
                                <MenuItem value="Sell">Sell</MenuItem>
                              </TextField>
                              <TextField
                                size="small"
                                type="number"
                                value={limitOrderForm.limitPrice}
                                onChange={(event) => handleLimitOrderFieldChange(index, 'limitPrice', event.target.value, rate, selection)}
                                placeholder="Price"
                                slotProps={{ htmlInput: { 'aria-label': `${selection.ccyPair} limit price` } }}
                                sx={{
                                  '& .MuiInputBase-root': {
                                    minHeight: 30,
                                    bgcolor: 'rgba(255,255,255,0.035)',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                  },
                                  '& .MuiInputBase-input': {
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    py: 0.72,
                                  },
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.2,
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.12)',
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.18)',
                                  },
                                }}
                              />
                            </Box>

                            <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                              <TextField
                                select
                                size="small"
                                value={limitOrderForm.timeInForce}
                                onChange={(event) => handleLimitOrderFieldChange(index, 'timeInForce', event.target.value, rate, selection)}
                                slotProps={{
                                  select: { displayEmpty: true },
                                  htmlInput: { 'aria-label': `${selection.ccyPair} limit order tif` },
                                }}
                                sx={{
                                  width: 74,
                                  '& .MuiInputBase-root': {
                                    minHeight: 30,
                                    bgcolor: 'rgba(255,255,255,0.035)',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                  },
                                  '& .MuiSelect-select': {
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    py: 0.62,
                                  },
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.2,
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.12)',
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.18)',
                                  },
                                }}
                              >
                                <MenuItem value="GTC">GTC</MenuItem>
                                <MenuItem value="GTD">GTD</MenuItem>
                              </TextField>

                              <Button
                                variant="contained"
                                size="small"
                                onClick={() =>
                                  handleSubmitLimitOrder({
                                    cardIndex: index,
                                    form: limitOrderForm,
                                    selection,
                                    dealtCurrency: selectedDealCurrency,
                                    qty: selectedDealQuantity,
                                    settlementDate: valueDate,
                                  })
                                }
                                disabled={submittingLimitIndex === index}
                                sx={{ minHeight: 30, fontSize: '0.72rem', px: 1 }}
                              >
                                {submittingLimitIndex === index ? 'Submitting…' : 'Submit limit order'}
                              </Button>
                            </Stack>
                          </>
                        ) : (
                          <Alert severity="info" sx={{ mb: 0 }}>
                            Switch the card tenor back to SP to place a limit order from the rate grid.
                          </Alert>
                        )}
                      </Stack>
                    </Paper>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Stack spacing={1.25}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Current limit orders</Typography>

            <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <Chip label={`${activeLimitOrders.length} active`} color={activeLimitOrders.length ? 'primary' : 'default'} size="small" />
              <Chip label={`${activeLimitOrders.filter((order) => order.timeInForce === 'GTD').length} GTD`} size="small" variant="outlined" />
              <Chip label={`${activeLimitOrders.filter((order) => order.timeInForce === 'GTC').length} GTC`} size="small" variant="outlined" />
            </Stack>
          </Paper>

          <Stack spacing={1}>
            {activeLimitOrders.length ? (
              activeLimitOrders.map((order) => {
                const referenceRate = quoteLookup.get(`${order.ccyPair}|${order.tenor}`);
                const liveMarketPrice = referenceRate ? (order.direction === 'Buy' ? referenceRate.ask : referenceRate.bid) : null;
                const atLimit =
                  liveMarketPrice == null
                    ? false
                    : order.direction === 'Buy'
                      ? liveMarketPrice <= Number(order.limitPrice)
                      : liveMarketPrice >= Number(order.limitPrice);

                return (
                  <Paper key={order.id} sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 0.75 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontSize: '0.95rem' }}>
                            {order.direction} {order.ccyPair}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                            {formatNotional(order.qty)} · {order.dealtCurrency} · {order.tenor}
                          </Typography>
                        </Box>
                        <Stack direction="row" gap={0.5} sx={{ flexWrap: 'wrap' }}>
                          <Chip
                            label={order.timeInForce}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 22,
                              '& .MuiChip-label': {
                                px: 0.75,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                              },
                            }}
                          />
                          <Chip
                            label={atLimit ? 'Trigger hit' : 'Working'}
                            size="small"
                            color={atLimit ? 'success' : 'default'}
                            sx={{
                              height: 22,
                              '& .MuiChip-label': {
                                px: 0.75,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                              },
                            }}
                          />
                        </Stack>
                      </Stack>

                      <Stack spacing={0.75}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography color="text.secondary" sx={{ fontSize: '0.78rem' }}>Trigger</Typography>
                          <Typography sx={{ fontSize: '0.8rem' }}>{formatRate(order.limitPrice)}</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography color="text.secondary" sx={{ fontSize: '0.78rem' }}>Live spot</Typography>
                          <Typography sx={{ fontSize: '0.8rem' }}>{liveMarketPrice == null ? 'N/A' : formatRate(liveMarketPrice)}</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography color="text.secondary" sx={{ fontSize: '0.78rem' }}>Good till</Typography>
                          <Typography sx={{ fontSize: '0.8rem' }}>{order.timeInForce === 'GTD' ? 'Today only' : 'Until cancelled'}</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                          <Typography color="text.secondary" sx={{ fontSize: '0.78rem' }}>Submitted</Typography>
                          <Typography sx={{ fontSize: '0.8rem' }}>{formatDateTime(order.submittedAt)}</Typography>
                        </Stack>
                      </Stack>

                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {order.id} · Trader {order.trader || 'system'}
                      </Typography>

                      {editingOrderId === order.id && amendOrderForm ? (
                        <Paper variant="outlined" sx={{ p: 1.1, borderColor: 'rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.015)' }}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Amend active order</Typography>
                            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                              <TextField
                                size="small"
                                label="Quantity"
                                type="number"
                                value={amendOrderForm.qty}
                                onChange={(event) => handleAmendOrderFieldChange('qty', event.target.value)}
                              />
                              <TextField
                                size="small"
                                label="Limit price"
                                type="number"
                                value={amendOrderForm.limitPrice}
                                onChange={(event) => handleAmendOrderFieldChange('limitPrice', event.target.value)}
                              />
                              <TextField
                                select
                                size="small"
                                label="TIF"
                                value={amendOrderForm.timeInForce}
                                onChange={(event) => handleAmendOrderFieldChange('timeInForce', event.target.value)}
                              >
                                <MenuItem value="GTC">GTC</MenuItem>
                                <MenuItem value="GTD">GTD</MenuItem>
                              </TextField>
                              {amendOrderForm.timeInForce === 'GTD' ? (
                                <Paper variant="outlined" sx={{ px: 1.25, py: 0.95, borderColor: 'rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.015)' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                                    Good till
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.35 }}>
                                    Today only
                                  </Typography>
                                </Paper>
                              ) : (
                                <Paper variant="outlined" sx={{ px: 1.25, py: 0.95, borderColor: 'rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.015)' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                                    Good till
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.35 }}>
                                    Until cancelled
                                  </Typography>
                                </Paper>
                              )}
                            </Box>
                            <TextField
                              size="small"
                              label="Comments"
                              value={amendOrderForm.comments}
                              onChange={(event) => handleAmendOrderFieldChange('comments', event.target.value)}
                              multiline
                              rows={2}
                            />
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleSaveAmendOrder(order)}
                                disabled={processingOrderId === order.id}
                              >
                                {processingOrderId === order.id && processingOrderAction === 'amend' ? 'Saving…' : 'Save amend'}
                              </Button>
                              <Button size="small" variant="text" onClick={resetAmendOrder} disabled={processingOrderId === order.id}>
                                Close
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ) : null}

                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => startAmendOrder(order)}
                          disabled={processingOrderId === order.id}
                        >
                          Amend
                        </Button>
                        <Button
                          size="small"
                          color="warning"
                          variant="text"
                          onClick={() => handleCancelOrder(order)}
                          disabled={processingOrderId === order.id}
                        >
                          {processingOrderId === order.id && processingOrderAction === 'cancel' ? 'Cancelling…' : 'Cancel order'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })
            ) : (
              <Paper sx={{ p: 2.5, textAlign: 'center' }}>
                <Typography variant="subtitle1">No active spot limit orders</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  Submit a GTC or GTD order from any spot rate card to start monitoring it on the server.
                </Typography>
              </Paper>
            )}
          </Stack>
        </Stack>
      </Box>

      {!visibleRates.length && !(isLoading || isGridLoading) ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6">No instruments match your filter</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Adjust the search, tenor, or sorting controls to restore the live market view.
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}

export default FXRateGrid;
