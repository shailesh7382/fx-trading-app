import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import type { AlertColor } from '@mui/material';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Chip, Divider } from '@mui/material';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchLookup } from '../api/client';
import { fallbackCustomers, fallbackRelationshipManagers, fallbackSales } from '../data/mockData';
import { calculateSettlementDate, formatCurrency, formatDateTime, formatNotional, formatRate, getCurrencyCodes } from '../utils/formatters';
import { useUser } from './UserProvider';
import { useWorkspaceContext } from './useWorkspaceData';
import type { Direction, FxRate, LookupItem, ProductType, Trade } from '../types';

const tenorOptions = ['SP', '1W', '1M', '3M', '6M', '1Y'];
const directionOptions: Direction[] = ['Buy', 'Sell'];
const quoteDurationSeconds = 30;
const DEFAULT_CUSTOMER_NAME = fallbackCustomers[0]?.name || 'Default customer';

/** Precious metals the bullion ticket can price. */
type MetalType = 'XAU' | 'XAG' | 'XPT' | 'XPD';

/** Every booking field is held as a string so the inputs stay controlled. */
interface BookingFormData {
  productType: ProductType;
  ccyPair: string;
  tenor: string;
  qty: string;
  price: string;
  direction: Direction;
  dealtCurrency: string;
  customer: string;
  rm: string;
  sales: string;
  tradeDate: string;
  settlementDate: string;
  farTenor: string;
  farSettlementDate: string;
  farPrice: string;
  fixingDate: string;
  fixingSource: string;
  nonDeliverableCurrency: string;
  metalType: MetalType;
  bullionSettlement: string;
  comments: string;
}

/** Router state handed over by the rate grid or the analysis screen. */
interface BookingLaunchState {
  quote?: FxRate;
  direction?: Direction;
  dealtCurrency?: string;
  qty?: number | string;
  valueDate?: string;
  settlementDate?: string;
  productType?: ProductType;
  customer?: string;
  rm?: string;
  sales?: string;
}

const productTypeOptions: Array<{ value: ProductType; label: string }> = [
  { value: 'SPOT_FWD', label: 'FX Spot/Fwd' },
  { value: 'SWAP', label: 'FX Swap' },
  { value: 'NDF', label: 'NDFs' },
  { value: 'BULLION', label: 'Bullion' },
];
const productTypeLabels: Record<string, string> = Object.fromEntries(
  productTypeOptions.map((option) => [option.value, option.label])
);
const fixingSourceOptions = ['WM/Reuters', 'CME reference', 'Local central bank'];
const bullionSettlementOptions = ['Unallocated', 'Allocated', 'Loco London'];
const bullionMetalPairs: Record<MetalType, string> = {
  XAU: 'XAUUSD',
  XAG: 'XAGUSD',
  XPT: 'XPTUSD',
  XPD: 'XPDUSD',
};

function getMarketPrice(direction: Direction, rate: FxRate | null | undefined): string {
  if (!rate) {
    return '';
  }

  return direction === 'Sell' ? String(rate.bid) : String(rate.ask);
}

function inferMetalType(ccyPair: string = ''): MetalType {
  const { base } = getCurrencyCodes(ccyPair);
  return bullionMetalPairs[base as MetalType] ? (base as MetalType) : 'XAU';
}

function getPairForMetal(metalType: MetalType = 'XAU'): string {
  return bullionMetalPairs[metalType] || bullionMetalPairs.XAU;
}

function getProductDescription(productType: ProductType): string {
  switch (productType) {
    case 'SWAP':
      return 'Near and far FX legs.';
    case 'NDF':
      return 'Non-deliverable forward.';
    case 'BULLION':
      return 'Precious metals trade.';
    case 'SPOT_FWD':
    default:
      return 'FX spot or forward.';
  }
}

function buildProductDetails(formData: BookingFormData): string {
  switch (formData.productType) {
    case 'SWAP':
      return `Near ${formData.tenor} settle ${formData.settlementDate} @ ${formData.price || '—'} · Far ${formData.farTenor} settle ${formData.farSettlementDate} @ ${formData.farPrice || '—'}`;
    case 'NDF':
      return `${formData.tenor} fixing ${formData.fixingDate} via ${formData.fixingSource} · NDS ${formData.nonDeliverableCurrency}`;
    case 'BULLION':
      return `${formData.metalType} settle ${formData.settlementDate} · ${formData.bullionSettlement}`;
    case 'SPOT_FWD':
    default:
      return `${formData.tenor} settle ${formData.settlementDate}`;
  }
}

function buildInitialForm(
  quote: FxRate | null | undefined,
  direction: Direction | undefined,
  launchState: BookingLaunchState = {}
): BookingFormData {
  const today = new Date().toISOString().slice(0, 10);
  const initialProductType = launchState.productType || 'SPOT_FWD';
  const initialTenor = quote?.tenor || 'SP';
  const initialSettlementDate = launchState.valueDate || launchState.settlementDate || calculateSettlementDate(today, initialTenor);
  const launchQuantity = Number.parseInt(String(launchState.qty ?? ''), 10);
  const initialQuantity = Number.isNaN(launchQuantity)
    ? quote?.qty
      ? String(Math.round(quote.qty))
      : '1000000'
    : String(launchQuantity);
  const defaultMetalType = inferMetalType(quote?.ccyPair || '');

  return {
    productType: initialProductType,
    ccyPair: quote?.ccyPair || '',
    tenor: initialTenor,
    qty: initialQuantity,
    price: getMarketPrice(direction || 'Buy', quote),
    direction: direction || 'Buy',
    dealtCurrency: launchState.dealtCurrency || getCurrencyCodes(quote?.ccyPair || '').base || '',
    customer: launchState.customer || DEFAULT_CUSTOMER_NAME,
    rm: launchState.rm || '',
    sales: launchState.sales || '',
    tradeDate: today,
    settlementDate: initialSettlementDate,
    farTenor: '1M',
    farSettlementDate: calculateSettlementDate(today, '1M'),
    farPrice: '',
    fixingDate: initialSettlementDate,
    fixingSource: 'WM/Reuters',
    nonDeliverableCurrency: getCurrencyCodes(quote?.ccyPair || '').terms || 'USD',
    metalType: defaultMetalType,
    bullionSettlement: 'Unallocated',
    comments: '',
  };
}

function FXTradeBooking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userDetails, bookTrade } = useUser();
  const { rates } = useWorkspaceContext();
  const routeState = (location.state as BookingLaunchState | null) || null;
  const incomingQuote = routeState?.quote;
  const incomingDirection: Direction = routeState?.direction || 'Buy';
  const incomingDealCurrency = routeState?.dealtCurrency;
  const incomingQty = routeState?.qty;
  const incomingValueDate = routeState?.valueDate || routeState?.settlementDate;
  const hasIncomingBookingState = Boolean(
    routeState?.quote || routeState?.direction || routeState?.dealtCurrency || routeState?.valueDate || routeState?.settlementDate || routeState?.qty
  );
  const preserveIncomingValueDateRef = useRef(Boolean(incomingValueDate));
  const [formData, setFormData] = useState<BookingFormData>(() =>
    buildInitialForm(incomingQuote, incomingDirection, {
      dealtCurrency: incomingDealCurrency,
      qty: incomingQty,
      valueDate: incomingValueDate,
    })
  );
  const [, setCustomers] = useState<LookupItem[]>(fallbackCustomers);
  const [relationshipManagers, setRelationshipManagers] = useState<LookupItem[]>(fallbackRelationshipManagers);
  const [salesPeople, setSalesPeople] = useState<LookupItem[]>(fallbackSales);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Trade | null>(null);
  const [confoInFlow, setConfoInFlow] = useState(false);
  const flipSceneRef = useRef<HTMLDivElement | null>(null);
  const hasFlippedRef = useRef(false);
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(incomingQuote ? quoteDurationSeconds : quoteDurationSeconds);
  const [quoteExpiresAt, setQuoteExpiresAt] = useState(Date.now() + quoteDurationSeconds * 1000);

  const activeRate = useMemo<FxRate | null>(() => {
    if (formData.ccyPair) {
      const exactMatch = rates.find((rate) => rate.ccyPair === formData.ccyPair && rate.tenor === formData.tenor);
      if (exactMatch) return exactMatch;

      const pairMatch = rates.find((rate) => rate.ccyPair === formData.ccyPair);
      if (pairMatch) {
        return pairMatch;
      }

      return incomingQuote?.ccyPair === formData.ccyPair ? incomingQuote : null;
    }

    return incomingQuote || rates[0] || null;
  }, [formData.ccyPair, formData.tenor, incomingQuote, rates]);

  const dealtCurrencyOptions = useMemo(() => {
    const { base, terms } = getCurrencyCodes(formData.ccyPair || activeRate?.ccyPair || '');
    return [base, terms].filter(Boolean);
  }, [activeRate?.ccyPair, formData.ccyPair]);

  const notional = Number(formData.qty || 0) * Number(formData.price || 0);
  const isFormComplete = useMemo(() => {
    const requiredValues = [
      formData.productType,
      formData.ccyPair,
      formData.tenor,
      formData.direction,
      formData.dealtCurrency,
      formData.tradeDate,
      formData.settlementDate,
      formData.rm,
      formData.sales,
    ];

    if (formData.productType === 'SWAP') {
      requiredValues.push(formData.farTenor, formData.farSettlementDate);
    }

    if (formData.productType === 'NDF') {
      requiredValues.push(formData.fixingDate, formData.fixingSource, formData.nonDeliverableCurrency);
    }

    if (formData.productType === 'BULLION') {
      requiredValues.push(formData.metalType, formData.bullionSettlement);
    }

    const hasRequiredText = requiredValues.every((value) => String(value || '').trim().length > 0);
    const quantity = Number(formData.qty);
    const price = Number(formData.price);
    const farPrice = Number(formData.farPrice);

    const hasValidPrimaryNumbers = Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price > 0;
    const hasValidSwapNumbers = formData.productType !== 'SWAP' || (Number.isFinite(farPrice) && farPrice > 0);

    return hasRequiredText && hasValidPrimaryNumbers && hasValidSwapNumbers;
  }, [
    formData.ccyPair,
    formData.dealtCurrency,
    formData.direction,
    formData.farPrice,
    formData.farSettlementDate,
    formData.farTenor,
    formData.fixingDate,
    formData.fixingSource,
    formData.metalType,
    formData.nonDeliverableCurrency,
    formData.price,
    formData.productType,
    formData.qty,
    formData.rm,
    formData.sales,
    formData.settlementDate,
    formData.tenor,
    formData.tradeDate,
    formData.bullionSettlement,
  ]);
  const quoteTimerActive = formData.productType === 'SPOT_FWD' && isFormComplete && Boolean(activeRate);
  const quoteExpired = quoteTimerActive && quoteTimeLeft <= 0;
  const quantityLabel = formData.productType === 'BULLION' ? 'Quantity (oz)' : 'Quantity';
  const pairLabel = formData.productType === 'BULLION' ? 'Metal pair' : 'Currency pair';
  const tenorLabel = formData.productType === 'SWAP' ? 'Near tenor' : formData.productType === 'NDF' ? 'Forward tenor' : 'Tenor';
  const priceLabel = formData.productType === 'SWAP' ? 'Near leg rate' : formData.productType === 'NDF' ? 'NDF rate' : formData.productType === 'BULLION' ? 'Metal price' : 'Price';
  const settlementLabel = formData.productType === 'SWAP' ? 'Near settlement' : 'Settlement date';

  useEffect(() => {
    let mounted = true;

    async function loadLookups() {
      const [customerList, rmList, salesList] = await Promise.all([
        fetchLookup('/customers', fallbackCustomers),
        fetchLookup('/relationshipManagers', fallbackRelationshipManagers),
        fetchLookup('/sales', fallbackSales),
      ]);

      if (!mounted) {
        return;
      }

      setCustomers(customerList);
      setRelationshipManagers(rmList);
      setSalesPeople(salesList);

      setFormData((current) => ({
        ...current,
        customer: current.customer || customerList[0]?.name || DEFAULT_CUSTOMER_NAME,
        rm: current.rm || rmList[0]?.name || '',
        sales: current.sales || salesList[0]?.name || '',
      }));
    }

    loadLookups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasIncomingBookingState) {
      return;
    }

    preserveIncomingValueDateRef.current = Boolean(incomingValueDate);
    setFormData((current) =>
      buildInitialForm(incomingQuote, incomingDirection, {
        dealtCurrency: incomingDealCurrency,
        qty: incomingQty,
        valueDate: incomingValueDate,
        customer: current.customer,
        rm: current.rm,
        sales: current.sales,
      })
    );
    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
    setSeverity('info');
    setMessage('');
    setConfirmation(null);
  }, [hasIncomingBookingState, incomingDealCurrency, incomingDirection, incomingQty, incomingQuote, incomingValueDate, location.key]);

  useEffect(() => {
    if (preserveIncomingValueDateRef.current) {
      preserveIncomingValueDateRef.current = false;
      return;
    }

    setFormData((current) => ({
      ...current,
      settlementDate: calculateSettlementDate(current.tradeDate, current.tenor),
    }));
  }, [formData.tenor, formData.tradeDate]);

  useEffect(() => {
    if (!activeRate && rates[0] && !formData.ccyPair) {
      setFormData((current) => ({
        ...current,
        ccyPair: rates[0].ccyPair,
        tenor: rates[0].tenor,
        dealtCurrency: getCurrencyCodes(rates[0].ccyPair).base,
        price: getMarketPrice(current.direction, rates[0]),
      }));
    }
  }, [activeRate, formData.ccyPair, rates]);

  useEffect(() => {
    if (!quoteTimerActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setQuoteTimeLeft(Math.max(0, Math.ceil((quoteExpiresAt - Date.now()) / 1000)));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [quoteExpiresAt, quoteTimerActive]);

  useEffect(() => {
    if (!quoteTimerActive) {
      setQuoteTimeLeft(quoteDurationSeconds);
      return;
    }

    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
  }, [quoteTimerActive]);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    setFormData((current) => {
      // `name` comes from the DOM, so the computed key needs one assertion here.
      const nextValue = { ...current, [name]: value } as BookingFormData;

      if (name === 'ccyPair') {
        const nextRate = rates.find((rate) => rate.ccyPair === value) || activeRate;
        nextValue.tenor = nextRate?.tenor || current.tenor;
        nextValue.dealtCurrency = getCurrencyCodes(value).base || '';
        nextValue.nonDeliverableCurrency = getCurrencyCodes(value).terms || current.nonDeliverableCurrency;
        nextValue.price = getMarketPrice(nextValue.direction, nextRate);
      }

      if (name === 'direction') {
        nextValue.price = getMarketPrice(value as Direction, activeRate);
      }

      if (name === 'metalType') {
        nextValue.ccyPair = getPairForMetal(value as MetalType);
        nextValue.dealtCurrency = value;
        nextValue.tenor = 'SP';
        nextValue.settlementDate = calculateSettlementDate(nextValue.tradeDate, 'SP');
        nextValue.nonDeliverableCurrency = 'USD';
        nextValue.price = '';
      }

      if (name === 'tenor' || name === 'tradeDate') {
        nextValue.settlementDate = calculateSettlementDate(
          name === 'tradeDate' ? value : nextValue.tradeDate,
          name === 'tenor' ? value : nextValue.tenor
        );
      }

      if (name === 'farTenor' || name === 'tradeDate') {
        nextValue.farSettlementDate = calculateSettlementDate(
          name === 'tradeDate' ? value : nextValue.tradeDate,
          name === 'farTenor' ? value : nextValue.farTenor
        );
      }

      return nextValue;
    });
  };

  const handleProductTypeChange = (_event: MouseEvent<HTMLElement>, nextProductType: ProductType | null) => {
    if (!nextProductType) {
      return;
    }

    setFormData((current) => {
      const nextValue = { ...current, productType: nextProductType };

      if (nextProductType === 'SWAP') {
        nextValue.farTenor = current.farTenor || '1M';
        nextValue.farSettlementDate = calculateSettlementDate(current.tradeDate, nextValue.farTenor);
        nextValue.farPrice = current.farPrice || current.price;
      }

      if (nextProductType === 'NDF') {
        nextValue.nonDeliverableCurrency = current.nonDeliverableCurrency || getCurrencyCodes(current.ccyPair).terms || 'USD';
        nextValue.fixingDate = current.fixingDate || current.settlementDate || current.tradeDate;
      }

      if (nextProductType === 'BULLION') {
        const nextMetalType = current.metalType || inferMetalType(current.ccyPair);
        nextValue.metalType = nextMetalType;
        nextValue.ccyPair = getPairForMetal(nextMetalType);
        nextValue.dealtCurrency = nextMetalType;
        nextValue.tenor = 'SP';
        nextValue.settlementDate = calculateSettlementDate(current.tradeDate, 'SP');
        nextValue.nonDeliverableCurrency = 'USD';
        nextValue.price = '';
      }

      if (nextProductType === 'SPOT_FWD' && current.productType === 'BULLION' && incomingQuote) {
        nextValue.ccyPair = incomingQuote.ccyPair;
        nextValue.tenor = incomingQuote.tenor || 'SP';
        nextValue.dealtCurrency = incomingDealCurrency || getCurrencyCodes(incomingQuote.ccyPair).base || current.dealtCurrency;
        nextValue.price = getMarketPrice(nextValue.direction, incomingQuote);
        nextValue.settlementDate = incomingValueDate || calculateSettlementDate(nextValue.tradeDate, nextValue.tenor);
      }

      return nextValue;
    });
  };

  const repriceTicket = () => {
    if (!activeRate) {
      return;
    }

    if (formData.productType !== 'SPOT_FWD') {
      setSeverity('info');
      setMessage('Live repricing is available for FX Spot/Fwd tickets only.');
      return;
    }

    if (!isFormComplete) {
      setSeverity('info');
      setMessage('Complete all booking fields to activate quote timing.');
      return;
    }

    setFormData((current) => ({
      ...current,
      price: getMarketPrice(current.direction, activeRate),
      tenor: activeRate.tenor,
    }));
    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
    setSeverity('info');
    setMessage('Quote refreshed from the latest market snapshot.');
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const settleDelay = prefersReducedMotion ? 0 : 350;
    const timeoutId = window.setTimeout(() => setConfoInFlow(Boolean(confirmation)), settleDelay);

    return () => window.clearTimeout(timeoutId);
  }, [confirmation]);

  useEffect(() => {
    if (!hasFlippedRef.current) {
      hasFlippedRef.current = true;
      return;
    }

    if (typeof flipSceneRef.current?.scrollIntoView !== 'function') {
      return;
    }

    flipSceneRef.current.scrollIntoView({ block: 'start' });
  }, [confoInFlow]);

  const startNewTicket = () => {
    setConfirmation(null);
    setMessage('');
    setSeverity('info');
    preserveIncomingValueDateRef.current = false;
    setFormData((current) =>
      buildInitialForm(activeRate, current.direction, {
        productType: current.productType,
        dealtCurrency: current.dealtCurrency,
        customer: current.customer,
        rm: current.rm,
        sales: current.sales,
      })
    );
    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormComplete) {
      setSeverity('error');
      setMessage('Complete all booking fields before booking the trade.');
      return;
    }

    if (quoteExpired && activeRate) {
      setSeverity('error');
      setMessage('Quote expired. Reprice the ticket before booking.');
      return;
    }

    setIsSubmitting(true);

    try {
      const bookedTrade = await bookTrade({
        ccyPair: formData.ccyPair,
        tenor: formData.tenor,
        qty: Number(formData.qty),
        direction: formData.direction,
        dealtCurrency: formData.dealtCurrency,
        price: Number(formData.price),
        customer: formData.customer,
        rm: formData.rm,
        sales: formData.sales,
        tradeDate: formData.tradeDate,
        settlementDate: formData.settlementDate,
        comments: formData.comments,
        productType: formData.productType,
        productDetails: buildProductDetails(formData),
        trader: userDetails?.username || 'demo.trader',
        marketSource: activeRate?.source || 'MANUAL',
      });

      setMessage('');
      setConfirmation(bookedTrade);
    } catch {
      setSeverity('error');
      setMessage('Booking failed. Reprice the ticket and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookingPaperSx = {
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    backgroundImage: 'none',
    boxShadow: 'none',
  };

  const quoteProtectionValue = quoteTimerActive ? Math.max(0, (quoteTimeLeft / quoteDurationSeconds) * 100) : 0;

  const confirmationDetails: Array<[string, string | undefined]> = confirmation
    ? [
        ['Trade ID', confirmation.id],
        ['Product', productTypeLabels[confirmation.productType || ''] || 'FX Spot/Fwd'],
        ['Instrument', confirmation.ccyPair],
        ['Direction', `${confirmation.direction} ${confirmation.dealtCurrency}`],
        ['Tenor', confirmation.tenor],
        ['Quantity', formatNotional(confirmation.qty)],
        ['Rate', formatRate(confirmation.price)],
        ['All-in notional', formatCurrency(Number(confirmation.qty || 0) * Number(confirmation.price || 0))],
        ['Trade date', confirmation.tradeDate],
        ['Settlement date', confirmation.settlementDate],
        ['Customer', confirmation.customer],
        ['Relationship manager', confirmation.rm],
        ['Sales', confirmation.sales],
        ['Trader', confirmation.trader],
        ['Booked at', formatDateTime(confirmation.bookedAt)],
      ]
    : [];

  const confirmationRows = confirmationDetails.filter(
    ([, value]) => String(value ?? '').trim().length > 0
  );

  return (
    <Stack
      spacing={2.25}
      sx={{
        '& .MuiInputBase-root': {
          bgcolor: 'background.paper',
        },
      }}
    >

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(340px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box ref={flipSceneRef} sx={{ perspective: '2000px', minWidth: 0, scrollMarginTop: 96 }}>
          <Box
            sx={{
              position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 700ms cubic-bezier(0.22, 0.61, 0.36, 1)',
              transform: confirmation ? 'rotateY(180deg)' : 'rotateY(0deg)',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
        <Paper
          component="form"
          onSubmit={handleSubmit}
          aria-hidden={confirmation ? 'true' : undefined}
          sx={{
            ...bookingPaperSx,
            p: { xs: 1.75, md: 2.25 },
            ...(confoInFlow ? { position: 'absolute', inset: 0, overflow: 'hidden' } : null),
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            visibility: confirmation ? 'hidden' : 'visible',
            transition: 'visibility 0s linear 350ms',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          <Stack spacing={2}>
            {message ? <Alert severity={severity}>{message}</Alert> : null}

            <Box>
              <Typography variant="h5">FX trade booking</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Product</Typography>
              <ToggleButtonGroup
                exclusive
                value={formData.productType}
                onChange={handleProductTypeChange}
                aria-label="fx product type"
                sx={{
                  mt: 1,
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  '& .MuiToggleButtonGroup-grouped': {
                    flex: { xs: '1 1 calc(50% - 6px)', md: '1 1 0' },
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    px: 1,
                    py: 0.8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    bgcolor: 'background.paper',
                  },
                  '& .Mui-selected': {
                    color: 'primary.contrastText !important',
                    bgcolor: 'primary.main !important',
                    borderColor: 'primary.main !important',
                  },
                }}
              >
                {productTypeOptions.map((option) => (
                  <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {getProductDescription(formData.productType)}
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              {formData.productType === 'BULLION' ? (
                <>
                  <TextField size="small" select label="Metal" name="metalType" value={formData.metalType} onChange={handleFieldChange}>
                    {Object.keys(bullionMetalPairs).map((metalOption) => (
                      <MenuItem key={metalOption} value={metalOption}>
                        {metalOption}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField size="small" label={pairLabel} name="ccyPair" value={formData.ccyPair} disabled />
                </>
              ) : (
                <>
                  <TextField size="small" select label={pairLabel} name="ccyPair" value={formData.ccyPair} onChange={handleFieldChange}>
                    {rates.map((rate) => (
                      <MenuItem key={`${rate.ccyPair}-${rate.tenor}`} value={rate.ccyPair}>
                        {rate.ccyPair}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField size="small" select label={tenorLabel} name="tenor" value={formData.tenor} onChange={handleFieldChange}>
                    {tenorOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
              <TextField size="small" select label="Direction" name="direction" value={formData.direction} onChange={handleFieldChange}>
                {directionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label={quantityLabel} name="qty" value={formData.qty} onChange={handleFieldChange} type="number" />
              <TextField size="small" select label="Dealt currency" name="dealtCurrency" value={formData.dealtCurrency} onChange={handleFieldChange}>
                {dealtCurrencyOptions.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label={priceLabel} name="price" value={formData.price} onChange={handleFieldChange} type="number" />
              <TextField
                size="small"
                label="Trade date"
                name="tradeDate"
                value={formData.tradeDate}
                onChange={handleFieldChange}
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                label={settlementLabel}
                name="settlementDate"
                value={formData.settlementDate}
                onChange={handleFieldChange}
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {formData.productType === 'SWAP' ? (
                <>
                  <TextField size="small" select label="Far tenor" name="farTenor" value={formData.farTenor} onChange={handleFieldChange}>
                    {tenorOptions.filter((option) => option !== 'SP').map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField size="small" label="Far leg rate" name="farPrice" value={formData.farPrice} onChange={handleFieldChange} type="number" />
                  <TextField
                    size="small"
                    label="Far settlement"
                    name="farSettlementDate"
                    value={formData.farSettlementDate}
                    onChange={handleFieldChange}
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              ) : null}
              {formData.productType === 'NDF' ? (
                <>
                  <TextField size="small" select label="NDS currency" name="nonDeliverableCurrency" value={formData.nonDeliverableCurrency} onChange={handleFieldChange}>
                    {dealtCurrencyOptions.map((currency) => (
                      <MenuItem key={currency} value={currency}>
                        {currency}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Fixing date"
                    name="fixingDate"
                    value={formData.fixingDate}
                    onChange={handleFieldChange}
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField size="small" select label="Fixing source" name="fixingSource" value={formData.fixingSource} onChange={handleFieldChange}>
                    {fixingSourceOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              ) : null}
              {formData.productType === 'BULLION' ? (
                <TextField size="small" select label="Bullion settlement" name="bullionSettlement" value={formData.bullionSettlement} onChange={handleFieldChange}>
                  {bullionSettlementOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Box>

            <Box>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                <TextField size="small" select label="Relationship manager" name="rm" value={formData.rm} onChange={handleFieldChange}>
                  {relationshipManagers.map((rm) => (
                    <MenuItem key={rm.id} value={rm.name}>
                      {rm.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField size="small" select label="Sales" name="sales" value={formData.sales} onChange={handleFieldChange}>
                  {salesPeople.map((salesPerson) => (
                    <MenuItem key={salesPerson.id} value={salesPerson.name}>
                      {salesPerson.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleFieldChange}
                  multiline
                  rows={3}
                  sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                bgcolor: 'background.default',
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <LinearProgress
                  variant="determinate"
                  value={quoteProtectionValue}
                  color={quoteExpired ? 'error' : 'primary'}
                  sx={{
                    flex: 1,
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'divider',
                  }}
                />
                <Typography variant="body2" color={quoteExpired ? 'error.main' : 'primary.light'} sx={{ flexShrink: 0, minWidth: 88, textAlign: 'right' }}>
                  {!quoteTimerActive ? 'Awaiting' : quoteExpired ? '0s left' : `${quoteTimeLeft}s left`}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {formData.productType !== 'SPOT_FWD'
                  ? 'Quote timer applies to FX Spot/Fwd only.'
                  : quoteTimerActive
                  ? `Price valid for ${quoteDurationSeconds} seconds.`
                  : 'Complete required fields to start the timer.'}
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Button size="small" type="button" variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={repriceTicket}>
                Refresh quote
              </Button>
              <Button size="small" type="submit" variant="contained" startIcon={<DoneAllRoundedIcon />} disabled={isSubmitting || quoteExpired || !isFormComplete} sx={{ minWidth: { sm: 168 } }}>
                {isSubmitting ? 'Booking trade…' : 'Book trade'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

            <Paper
              aria-hidden={confirmation ? undefined : 'true'}
              sx={{
                ...bookingPaperSx,
                ...(confoInFlow ? null : { position: 'absolute', inset: 0, overflow: 'auto' }),
                p: { xs: 1.75, md: 2.25 },
                borderColor: 'success.main',
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                visibility: confirmation ? 'visible' : 'hidden',
                transition: 'visibility 0s linear 350ms',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              {confirmation ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                    <ReceiptLongRoundedIcon color="success" />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="h5">Trade confirmation</Typography>
                      <Typography color="text.secondary">Trade {confirmation.id} booked.</Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={confirmation.bookingMode === 'live' ? 'primary' : 'warning'}
                      label={confirmation.bookingMode === 'live' ? 'Live capture' : 'Local fallback'}
                    />
                  </Stack>

                  <Divider />

                  <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                    {confirmationRows.map(([label, value]) => (
                      <Stack key={label} direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">{label}</Typography>
                        <Typography sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
                      </Stack>
                    ))}
                  </Box>

                  {confirmation.productDetails ? (
                    <Typography color="text.secondary">{confirmation.productDetails}</Typography>
                  ) : null}
                  {confirmation.comments ? <Typography color="text.secondary">{confirmation.comments}</Typography> : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Button size="small" variant="outlined" startIcon={<AddCircleOutlineRoundedIcon />} onClick={startNewTicket}>
                      Book another
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<ReceiptLongRoundedIcon />}
                      onClick={() => {
                        window.scrollTo(0, 0);
                        navigate('/app/blotter', { state: { bookedTradeId: confirmation.id } });
                      }}
                      sx={{ minWidth: { sm: 168 } }}
                    >
                      View in blotter
                    </Button>
                  </Stack>
                </Stack>
              ) : null}
            </Paper>
          </Box>
        </Box>

        <Stack spacing={2} sx={{ position: { xl: 'sticky' }, top: { xl: 104 } }}>
          <Paper sx={{ ...bookingPaperSx, p: 2 }}>
            <Typography variant="h6">Quote summary</Typography>
            <Stack spacing={1} sx={{ mt: 1.25 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Product</Typography>
                <Typography>{productTypeLabels[formData.productType] || 'FX Spot/Fwd'}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Instrument</Typography>
                <Typography>{formData.ccyPair || 'Select a pair'}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Direction</Typography>
                <Typography>{formData.direction}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Tradeable amount</Typography>
                <Typography>{formatNotional(formData.qty)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">All-in notional</Typography>
                <Typography>{formatCurrency(notional)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Live price</Typography>
                <Typography>{formData.productType === 'SPOT_FWD' && activeRate ? formatRate(formData.price) : 'Manual'}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography color="text.secondary">Structure</Typography>
                <Typography sx={{ maxWidth: 180, textAlign: 'right' }}>{buildProductDetails(formData)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Customer</Typography>
                <Typography>{formData.customer || DEFAULT_CUSTOMER_NAME}</Typography>
              </Stack>
            </Stack>
          </Paper>

        </Stack>
      </Box>
    </Stack>
  );
}

export default FXTradeBooking;
