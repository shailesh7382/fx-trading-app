import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlertColor } from '@mui/material';
import { Alert, Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  amendLimitOrder,
  cancelLimitOrder,
  extractApiMessage,
  fetchFxGrid,
  submitLimitOrder,
} from '@/shared/api/client';
import { useUser } from '@/features/auth/UserProvider';
import { useWorkspaceContext } from '@/features/workspace/useWorkspaceData';
import type { Direction, FxRate, LimitOrder, NormalizedRate } from '@/shared/types';
import {
  calculateSettlementDate,
  formatRelativeTime,
  getCurrencyCodes,
} from '@/shared/utils/formatters';
import RateTile from './RateTile';
import type { TileFlash } from './RateTile';
import WorkingOrdersPanel from './WorkingOrdersPanel';
import type { AmendOrderForm } from './WorkingOrdersPanel';
import type { LimitOrderForm } from './LimitTicket';
import { getTenorSortOrder, getTickSignal } from './presentation';

const flashDurationMs = 900;
const maxVisibleRates = 6;

interface CardSelection {
  ccyPair: string;
  tenor: string;
}

/** A rate card that resolved to a live quote, ready to render. */
interface DisplayedCard {
  selection: CardSelection;
  quote: FxRate;
  index: number;
}

interface LimitOrderFeedback {
  severity: AlertColor;
  message: string;
}

function sanitizeQuantityInput(value: string = ''): string {
  return String(value).replace(/[^\d]/g, '');
}

function getInitialDealQuantity(rate: FxRate | undefined): string {
  const roundedQuantity = Math.round(Number(rate?.qty || 0));

  return roundedQuantity ? String(roundedQuantity) : '1000000';
}

function getInitialLimitPrice(direction: Direction, rate: FxRate | undefined): string {
  if (!rate) {
    return '';
  }

  return String(direction === 'Sell' ? rate.bid : rate.ask);
}

function getDefaultGoodTillDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialLimitOrderForm(rate: FxRate | undefined, selection?: CardSelection): LimitOrderForm {
  return {
    ccyPair: selection?.ccyPair || rate?.ccyPair || '',
    tenor: selection?.tenor || rate?.tenor || 'SP',
    direction: 'Buy',
    limitPrice: getInitialLimitPrice('Buy', rate),
    timeInForce: 'GTC',
    goodTillDate: getDefaultGoodTillDate(),
  };
}

function buildAmendOrderForm(order: LimitOrder): AmendOrderForm {
  return {
    qty: String(Math.round(Number(order?.qty || 0))),
    limitPrice: String(order?.limitPrice || ''),
    timeInForce: order?.timeInForce || 'GTC',
    goodTillDate: order?.goodTillDate || getDefaultGoodTillDate(),
    comments: order?.comments || '',
  };
}

function RateGrid() {
  const navigate = useNavigate();
  const { userDetails } = useUser();
  const { rates, error, isLoading, limitOrders, lastUpdated, refresh, manualRefreshToken } =
    useWorkspaceContext();

  const [serverRates, setServerRates] = useState<FxRate[]>([]);
  const [gridRequestFailed, setGridRequestFailed] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const previousRatesRef = useRef<Map<string, { bid: number; ask: number }>>(new Map());
  const [flashSignals, setFlashSignals] = useState<Record<string, TileFlash>>({});
  const [cardSelections, setCardSelections] = useState<CardSelection[]>([]);
  const [dealCurrencies, setDealCurrencies] = useState<string[]>([]);
  const [dealQuantities, setDealQuantities] = useState<string[]>([]);
  const [editingQuantityIndex, setEditingQuantityIndex] = useState<number | null>(null);
  const [limitOrderForms, setLimitOrderForms] = useState<LimitOrderForm[]>([]);
  const [submittingLimitIndex, setSubmittingLimitIndex] = useState<number | null>(null);
  const [limitOrderFeedback, setLimitOrderFeedback] = useState<LimitOrderFeedback | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [amendOrderForm, setAmendOrderForm] = useState<AmendOrderForm | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [processingOrderAction, setProcessingOrderAction] = useState<'' | 'amend' | 'cancel'>('');

  /** One quote per instrument/tenor, newest wins, ordered pair then tenor. */
  const displayRates = useMemo(() => {
    const grouped = new Map<string, NormalizedRate>();

    rates.forEach((rate) => {
      const key = `${rate.ccyPair}|${rate.tenor}`;
      const existing = grouped.get(key);
      const existingUpdatedAt = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const nextUpdatedAt = rate?.updatedAt ? new Date(rate.updatedAt).getTime() : 0;

      if (
        !existing ||
        nextUpdatedAt > existingUpdatedAt ||
        (nextUpdatedAt === existingUpdatedAt && Number(rate.qty || 0) > Number(existing.qty || 0))
      ) {
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
    const tenorMap = new Map<string, string[]>();

    displayRates.forEach((rate) => {
      const currentTenors = tenorMap.get(rate.ccyPair) || [];
      if (!currentTenors.includes(rate.tenor)) {
        currentTenors.push(rate.tenor);
      }
      currentTenors.sort(
        (left, right) => getTenorSortOrder(left) - getTenorSortOrder(right) || left.localeCompare(right)
      );
      tenorMap.set(rate.ccyPair, currentTenors);
    });

    return tenorMap;
  }, [displayRates]);

  const fallbackRates = useMemo(
    () => [...rates].sort((left, right) => left.ccyPair.localeCompare(right.ccyPair)),
    [rates]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadGridRates() {
      setIsGridLoading(true);

      try {
        const data = await fetchFxGrid({ limit: maxVisibleRates });

        if (!isMounted) {
          return;
        }

        setServerRates(data);
        setGridRequestFailed(false);
      } catch {
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

    const loadTimer = window.setTimeout(loadGridRates, 120);

    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
    };
  }, [manualRefreshToken]);

  const visibleRates: FxRate[] = gridRequestFailed ? fallbackRates.slice(0, maxVisibleRates) : serverRates;

  useEffect(() => {
    setCardSelections((previousSelections) => {
      const defaultSelections = visibleRates.map((rate) => ({
        ccyPair: rate.ccyPair,
        tenor: rate.tenor,
      }));

      if (!defaultSelections.length) {
        return [];
      }

      if (!previousSelections.length || previousSelections.length !== defaultSelections.length) {
        return defaultSelections;
      }

      return defaultSelections.map((fallbackSelection, index) => {
        const previousSelection = previousSelections[index];
        if (!previousSelection) {
          return fallbackSelection;
        }

        if (quoteLookup.has(`${previousSelection.ccyPair}|${previousSelection.tenor}`)) {
          return previousSelection;
        }

        const availableTenors = tenorsByPair.get(previousSelection.ccyPair);
        if (availableTenors?.length) {
          return { ccyPair: previousSelection.ccyPair, tenor: availableTenors[0] };
        }

        return fallbackSelection;
      });
    });
  }, [quoteLookup, tenorsByPair, visibleRates]);

  const displayedCards = useMemo<DisplayedCard[]>(
    () =>
      cardSelections
        .map((selection, index) => ({
          selection,
          quote: (quoteLookup.get(`${selection.ccyPair}|${selection.tenor}`) || visibleRates[index]) as
            | FxRate
            | undefined,
          index,
        }))
        .filter((card): card is DisplayedCard => Boolean(card.quote)),
    [cardSelections, quoteLookup, visibleRates]
  );

  useEffect(() => {
    setDealCurrencies((previousSelections) =>
      displayedCards.map((card, index) => {
        const { base, terms } = getCurrencyCodes(card.selection.ccyPair);
        const previousSelection = previousSelections[index];

        return previousSelection === base || previousSelection === terms ? previousSelection : base;
      })
    );
  }, [displayedCards]);

  useEffect(() => {
    setDealQuantities((previousSelections) =>
      displayedCards.map((card, index) => {
        const previousSelection = sanitizeQuantityInput(previousSelections[index]);

        return previousSelection || getInitialDealQuantity(card.quote);
      })
    );
  }, [displayedCards]);

  useEffect(() => {
    setLimitOrderForms((previousForms) =>
      displayedCards.map((card, index) => {
        const previousForm = previousForms[index];

        if (
          previousForm &&
          previousForm.ccyPair === card.selection.ccyPair &&
          previousForm.tenor === card.selection.tenor
        ) {
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
    const nextSignals: Record<string, TileFlash> = {};

    visibleRates.forEach((rate) => {
      const key = `${rate.ccyPair}-${rate.tenor}`;
      const previous = previousRatesRef.current.get(key);
      const bidSignal = getTickSignal(rate.bid, previous?.bid);
      const askSignal = getTickSignal(rate.ask, previous?.ask);

      if (bidSignal || askSignal) {
        nextSignals[key] = { bid: bidSignal, ask: askSignal };
      }
    });

    previousRatesRef.current = new Map(
      visibleRates.map((rate) => [`${rate.ccyPair}-${rate.tenor}`, { bid: rate.bid, ask: rate.ask }] as const)
    );

    if (!Object.keys(nextSignals).length) {
      return undefined;
    }

    setFlashSignals(nextSignals);

    const clearTimer = window.setTimeout(() => setFlashSignals({}), flashDurationMs);

    return () => window.clearTimeout(clearTimer);
  }, [visibleRates]);

  const activeLimitOrders = useMemo(
    () => (Array.isArray(limitOrders) ? limitOrders.filter((order) => order?.status === 'ACTIVE') : []),
    [limitOrders]
  );

  const handlePairChange = (cardIndex: number, ccyPair: string) => {
    const nextTenor = (tenorsByPair.get(ccyPair) || [])[0] || 'SP';

    setCardSelections((previousSelections) =>
      previousSelections.map((selection, index) =>
        index === cardIndex ? { ccyPair, tenor: nextTenor } : selection
      )
    );
  };

  const handleTenorChange = (cardIndex: number, tenor: string) => {
    setCardSelections((previousSelections) =>
      previousSelections.map((selection, index) => (index === cardIndex ? { ...selection, tenor } : selection))
    );
  };

  const toggleDealCurrency = (cardIndex: number, base: string, terms: string) => {
    if (!base || !terms) {
      return;
    }

    setDealCurrencies((previousSelections) =>
      previousSelections.map((selection, index) =>
        index === cardIndex ? (selection === terms ? base : terms) : selection
      )
    );
  };

  const handleDealQuantityChange = (cardIndex: number, value: string) => {
    const nextValue = sanitizeQuantityInput(value);

    setDealQuantities((previousSelections) =>
      previousSelections.map((selection, index) => (index === cardIndex ? nextValue : selection))
    );
  };

  const handleLimitOrderFieldChange = (
    cardIndex: number,
    field: keyof LimitOrderForm,
    value: string,
    rate: FxRate,
    selection: CardSelection
  ) => {
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
            direction: value as Direction,
            limitPrice: getInitialLimitPrice(value as Direction, rate),
          };
        }

        if (field === 'timeInForce') {
          return {
            ...form,
            ccyPair: selection.ccyPair,
            tenor: selection.tenor,
            timeInForce: value as LimitOrderForm['timeInForce'],
            goodTillDate: form.goodTillDate || getDefaultGoodTillDate(),
          };
        }

        return {
          ...form,
          ccyPair: selection.ccyPair,
          tenor: selection.tenor,
          [field]: value,
        } as LimitOrderForm;
      })
    );
  };

  const handleSubmitLimitOrder = async (card: DisplayedCard) => {
    const { selection, quote, index } = card;
    const form = limitOrderForms[index] || buildInitialLimitOrderForm(quote, selection);
    const dealtCurrency = dealCurrencies[index] || getCurrencyCodes(selection.ccyPair).base;
    const settlementDate = quote.valueDate || calculateSettlementDate(new Date().toISOString(), selection.tenor);

    if (selection.tenor !== 'SP') {
      setLimitOrderFeedback({ severity: 'info', message: 'Limit orders are available for spot cards only.' });
      return;
    }

    const parsedQty = Number.parseInt(dealQuantities[index] || '', 10);
    const parsedLimitPrice = Number(form.limitPrice);

    if (!parsedQty) {
      setLimitOrderFeedback({ severity: 'error', message: 'Enter a valid quantity before submitting a limit order.' });
      return;
    }

    if (!parsedLimitPrice) {
      setLimitOrderFeedback({
        severity: 'error',
        message: 'Enter a valid limit price before submitting a limit order.',
      });
      return;
    }

    setSubmittingLimitIndex(index);

    try {
      const submittedOrder = await submitLimitOrder({
        ccyPair: selection.ccyPair,
        tenor: selection.tenor,
        qty: parsedQty,
        direction: form.direction,
        dealtCurrency,
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

  const startAmendOrder = (order: LimitOrder) => {
    setEditingOrderId(order.id);
    setAmendOrderForm(buildAmendOrderForm(order));
  };

  const handleAmendOrderFieldChange = (field: keyof AmendOrderForm, value: string) => {
    setAmendOrderForm((currentForm) =>
      currentForm ? ({ ...currentForm, [field]: value } as AmendOrderForm) : currentForm
    );
  };

  const resetAmendOrder = () => {
    setEditingOrderId(null);
    setAmendOrderForm(null);
  };

  const handleSaveAmendOrder = async (order: LimitOrder) => {
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
        timeInForce: amendOrderForm!.timeInForce,
        goodTillDate: amendOrderForm!.timeInForce === 'GTD' ? amendOrderForm!.goodTillDate : null,
        comments: amendOrderForm!.comments,
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

  const handleCancelOrder = async (order: LimitOrder) => {
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

  const handleTrade = (card: DisplayedCard, direction: Direction) => {
    const { selection, quote, index } = card;
    const { base } = getCurrencyCodes(selection.ccyPair);
    const dealtCurrency = dealCurrencies[index] || base;
    const valueDate = quote.valueDate || calculateSettlementDate(new Date().toISOString(), selection.tenor);
    const qty =
      Number.parseInt(dealQuantities[index] || '', 10) || Number.parseInt(getInitialDealQuantity(quote), 10);

    navigate('/app/booking', {
      state: { quote, direction, dealtCurrency, valueDate, qty },
    });
  };

  const isInitialLoad = (isLoading || isGridLoading) && !displayedCards.length;

  return (
    <Stack spacing={{ xs: 1.25, md: 1.5 }}>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {limitOrderFeedback ? (
        <Alert severity={limitOrderFeedback.severity} onClose={() => setLimitOrderFeedback(null)}>
          {limitOrderFeedback.message}
        </Alert>
      ) : null}

      <Paper
        sx={{
          px: { xs: 1.5, md: 2 },
          py: { xs: 0.85, md: 1 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: gridRequestFailed ? '#B3801F' : '#12855C',
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {gridRequestFailed ? 'Cached prices' : 'Streaming'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            · {displayedCards.length} instruments
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {activeLimitOrders.length} working {activeLimitOrders.length === 1 ? 'order' : 'orders'} · updated{' '}
          {formatRelativeTime(lastUpdated)}
        </Typography>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.25, md: 1.5 },
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(288px, 320px)' },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.25, md: 1.5 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' },
            alignItems: 'start',
          }}
        >
          {isInitialLoad
            ? [0, 1, 2, 3].map((placeholder) => (
                <Skeleton key={placeholder} variant="rounded" height={248} />
              ))
            : displayedCards.map((card) => {
                const { quote: rate, selection, index } = card;
                const { base, terms } = getCurrencyCodes(selection.ccyPair);

                return (
                  <RateTile
                    key={`${selection.ccyPair}-${selection.tenor}-${index}`}
                    rate={rate}
                    ccyPair={selection.ccyPair}
                    tenor={selection.tenor}
                    pairOptions={pairOptions}
                    tenorOptions={tenorsByPair.get(selection.ccyPair) || [selection.tenor]}
                    flash={flashSignals[`${rate.ccyPair}-${rate.tenor}`]}
                    dealQuantity={dealQuantities[index] || getInitialDealQuantity(rate)}
                    isEditingQuantity={editingQuantityIndex === index}
                    dealtCurrency={dealCurrencies[index] || base}
                    valueDate={
                      rate.valueDate || calculateSettlementDate(new Date().toISOString(), selection.tenor)
                    }
                    limitForm={limitOrderForms[index] || buildInitialLimitOrderForm(rate, selection)}
                    isSubmittingLimit={submittingLimitIndex === index}
                    onPairChange={(value) => handlePairChange(index, value)}
                    onTenorChange={(value) => handleTenorChange(index, value)}
                    onQuantityChange={(value) => handleDealQuantityChange(index, value)}
                    onQuantityFocus={() => setEditingQuantityIndex(index)}
                    onQuantityBlur={() =>
                      setEditingQuantityIndex((currentIndex) => (currentIndex === index ? null : currentIndex))
                    }
                    onToggleDealCurrency={() => toggleDealCurrency(index, base, terms)}
                    onTrade={(direction) => handleTrade(card, direction)}
                    onLimitFieldChange={(field, value) =>
                      handleLimitOrderFieldChange(index, field, value, rate, selection)
                    }
                    onSubmitLimit={() => handleSubmitLimitOrder(card)}
                  />
                );
              })}
        </Box>

        <WorkingOrdersPanel
          orders={activeLimitOrders}
          quoteLookup={quoteLookup}
          editingOrderId={editingOrderId}
          amendForm={amendOrderForm}
          processingOrderId={processingOrderId}
          processingOrderAction={processingOrderAction}
          onStartAmend={startAmendOrder}
          onAmendFieldChange={handleAmendOrderFieldChange}
          onSaveAmend={handleSaveAmendOrder}
          onResetAmend={resetAmendOrder}
          onCancel={handleCancelOrder}
        />
      </Box>

      {!displayedCards.length && !isInitialLoad ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            No instruments available
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            Prices will appear here as soon as the pricing service publishes a quote.
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}

export default RateGrid;
