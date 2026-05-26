import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputBase,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { fetchFxGrid } from '../api/client';
import { calculateSettlementDate, getCurrencyCodes, getRateDisplayParts } from '../utils/formatters';

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
    p: 1.1,
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
        sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 500, color: 'text.secondary', mt: 0.5 }}
      >
        {major}
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: { xs: '2.45rem', md: '3.25rem' }, fontWeight: 800, letterSpacing: '0.01em', color: accentColor }}
      >
        {significant}
      </Typography>
      {pipette ? (
        <Typography component="span" sx={{ fontSize: { xs: '0.85rem', md: '1rem' }, fontWeight: 700, mt: 0.4, color: 'text.secondary' }}>
          {pipette}
        </Typography>
      ) : null}
    </Box>
  );
}

function FXRateGrid() {
  const navigate = useNavigate();
  const { rates, error, isLoading, lastUpdated } = useOutletContext();
  const maxVisibleRates = 6;
  const [serverRates, setServerRates] = useState([]);
  const [gridRequestFailed, setGridRequestFailed] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const previousRatesRef = useRef(new Map());
  const selectionSeedRef = useRef({ search: '', sortBy: 'pair' });
  const [flashSignals, setFlashSignals] = useState({});
  const [cardSelections, setCardSelections] = useState([]);
  const [dealCurrencies, setDealCurrencies] = useState([]);
  const [dealQuantities, setDealQuantities] = useState([]);
  const [editingQuantityIndex, setEditingQuantityIndex] = useState(null);

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
  }, [maxVisibleRates, lastUpdated]);

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

  const buildBookingState = (rate, direction, dealtCurrency, valueDate, qty) => ({
    quote: rate,
    direction,
    dealtCurrency,
    valueDate,
    qty,
  });

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
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

          return (
            <Card key={`${selection.ccyPair}-${selection.tenor}-${index}`} sx={{ borderRadius: 1 }}>
            <CardContent sx={{ p: { xs: 1.5, md: 1.75 }, '&:last-child': { pb: { xs: 1.5, md: 1.75 } } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack direction="row" spacing={0.5} sx={{ width: '100%', flexWrap: 'wrap' }}>
                    <TextField
                      select
                      size="small"
                      value={selection.ccyPair}
                      onChange={(event) => handlePairChange(index, event.target.value)}
                      sx={{
                        minWidth: 138,
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0.45,
                          bgcolor: 'rgba(255,255,255,0.02)',
                        },
                        '& .MuiSelect-select': {
                          py: 0.6,
                          fontSize: '0.82rem',
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
                        width: 88,
                        flexShrink: 0,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0.45,
                          bgcolor: 'rgba(255,255,255,0.02)',
                        },
                        '& .MuiSelect-select': {
                          py: 0.6,
                          fontSize: '0.82rem',
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

                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Paper sx={getQuoteTileStyles('rgba(255, 107, 129, 0.08)', flashSignals[`${rate.ccyPair}-${rate.tenor}`]?.bid)}>
                    <RateDisplay value={rate.bid} accentColor="error.main" />
                    <Button
                      fullWidth
                      color="error"
                      variant="outlined"
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700 }}
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
                      variant="contained"
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700 }}
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
                    p: 0.75,
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
                        px: 1,
                        py: 0.5,
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
                          flex: '0 1 140px',
                          minWidth: 96,
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          fontVariantNumeric: 'tabular-nums',
                          '& input': {
                            p: 0,
                            textAlign: 'right',
                          },
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
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

                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, whiteSpace: 'nowrap', ml: 'auto' }}>
                      {valueDate}
                    </Typography>
                  </Stack>
                </Paper>

              </Stack>
            </CardContent>
          </Card>
          );
        })}
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
