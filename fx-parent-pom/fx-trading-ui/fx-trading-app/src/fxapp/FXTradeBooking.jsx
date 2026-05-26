import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { alpha } from '@mui/material/styles';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useLocation, useOutletContext } from 'react-router-dom';
import { fetchLookup } from '../api/client';
import { fallbackCustomers, fallbackRelationshipManagers, fallbackSales } from '../data/mockData';
import { calculateSettlementDate, formatCurrency, formatNotional, formatRate, getCurrencyCodes } from '../utils/formatters';
import UserContext from './UserContext';

const tenorOptions = ['SP', '1W', '1M', '3M', '6M', '1Y'];
const directionOptions = ['Buy', 'Sell'];
const quoteDurationSeconds = 30;
const DEFAULT_CUSTOMER_NAME = fallbackCustomers[0]?.name || 'Default customer';
const productTypeOptions = [
  { value: 'SPOT_FWD', label: 'FX Spot/Fwd' },
  { value: 'SWAP', label: 'FX Swap' },
  { value: 'NDF', label: 'NDFs' },
  { value: 'BULLION', label: 'Bullion' },
];
const productTypeLabels = Object.fromEntries(productTypeOptions.map((option) => [option.value, option.label]));
const fixingSourceOptions = ['WM/Reuters', 'CME reference', 'Local central bank'];
const bullionSettlementOptions = ['Unallocated', 'Allocated', 'Loco London'];
const bullionMetalPairs = {
  XAU: 'XAUUSD',
  XAG: 'XAGUSD',
  XPT: 'XPTUSD',
  XPD: 'XPDUSD',
};

function getMarketPrice(direction, rate) {
  if (!rate) {
    return '';
  }

  return direction === 'Sell' ? String(rate.bid) : String(rate.ask);
}

function inferMetalType(ccyPair = '') {
  const { base } = getCurrencyCodes(ccyPair);
  return bullionMetalPairs[base] ? base : 'XAU';
}

function getPairForMetal(metalType = 'XAU') {
  return bullionMetalPairs[metalType] || bullionMetalPairs.XAU;
}

function getProductDescription(productType) {
  switch (productType) {
    case 'SWAP':
      return 'Capture near and far legs for an FX swap with linked settlement dates and pricing.';
    case 'NDF':
      return 'Book a non-deliverable forward with fixing instructions and settlement metadata.';
    case 'BULLION':
      return 'Capture precious metals flow with metal selection, settlement type, and manual pricing.';
    case 'SPOT_FWD':
    default:
      return 'Book an FX spot or forward ticket from live rates or manual input.';
  }
}

function buildProductDetails(formData) {
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

function buildInitialForm(quote, direction, launchState = {}) {
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
    dealtCurrency: launchState.dealtCurrency || getCurrencyCodes(quote?.ccyPair).base || '',
    customer: launchState.customer || DEFAULT_CUSTOMER_NAME,
    rm: '',
    sales: '',
    tradeDate: today,
    settlementDate: initialSettlementDate,
    farTenor: '1M',
    farSettlementDate: calculateSettlementDate(today, '1M'),
    farPrice: '',
    fixingDate: initialSettlementDate,
    fixingSource: 'WM/Reuters',
    nonDeliverableCurrency: getCurrencyCodes(quote?.ccyPair).terms || 'USD',
    metalType: defaultMetalType,
    bullionSettlement: 'Unallocated',
    comments: '',
  };
}

function FXTradeBooking() {
  const location = useLocation();
  const { userDetails, bookTrade } = useContext(UserContext);
  const { rates } = useOutletContext();
  const incomingQuote = location.state?.quote;
  const incomingDirection = location.state?.direction || 'Buy';
  const incomingDealCurrency = location.state?.dealtCurrency;
  const incomingQty = location.state?.qty;
  const incomingValueDate = location.state?.valueDate || location.state?.settlementDate;
  const hasIncomingBookingState = Boolean(
    location.state?.quote || location.state?.direction || location.state?.dealtCurrency || location.state?.valueDate || location.state?.settlementDate || location.state?.qty
  );
  const preserveIncomingValueDateRef = useRef(Boolean(incomingValueDate));
  const [formData, setFormData] = useState(() =>
    buildInitialForm(incomingQuote, incomingDirection, {
      dealtCurrency: incomingDealCurrency,
      qty: incomingQty,
      valueDate: incomingValueDate,
    })
  );
  const [, setCustomers] = useState(fallbackCustomers);
  const [relationshipManagers, setRelationshipManagers] = useState(fallbackRelationshipManagers);
  const [salesPeople, setSalesPeople] = useState(fallbackSales);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(incomingQuote ? quoteDurationSeconds : quoteDurationSeconds);
  const [quoteExpiresAt, setQuoteExpiresAt] = useState(Date.now() + quoteDurationSeconds * 1000);

  const activeRate = useMemo(() => {
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
      formData.comments,
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
    formData.comments,
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
    setFormData(
      buildInitialForm(incomingQuote, incomingDirection, {
        dealtCurrency: incomingDealCurrency,
        qty: incomingQty,
        valueDate: incomingValueDate,
      })
    );
    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
    setSeverity('info');
    setMessage('');
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

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => {
      const nextValue = { ...current, [name]: value };

      if (name === 'ccyPair') {
        const nextRate = rates.find((rate) => rate.ccyPair === value) || activeRate;
        nextValue.tenor = nextRate?.tenor || current.tenor;
        nextValue.dealtCurrency = getCurrencyCodes(value).base || '';
        nextValue.nonDeliverableCurrency = getCurrencyCodes(value).terms || current.nonDeliverableCurrency;
        nextValue.price = getMarketPrice(nextValue.direction, nextRate);
      }

      if (name === 'direction') {
        nextValue.price = getMarketPrice(value, activeRate);
      }

      if (name === 'metalType') {
        nextValue.ccyPair = getPairForMetal(value);
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

  const handleProductTypeChange = (_event, nextProductType) => {
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

  const handleSubmit = async (event) => {
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
      await bookTrade({
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
      }).then((bookedTrade) => {
        setSeverity('success');
        setMessage(`Trade ${bookedTrade.id} booked successfully (${bookedTrade.bookingMode} capture).`);
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookingPaperSx = {
    borderRadius: 1,
    border: '1px solid',
    borderColor: (theme) => alpha(theme.palette.primary.light, 0.18),
    bgcolor: (theme) => alpha(theme.palette.common.white, 0.05),
    backgroundImage: (theme) => `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 100%)`,
    boxShadow: (theme) => `0 18px 40px ${alpha(theme.palette.common.black, 0.2)}`,
    backdropFilter: 'blur(12px)',
  };

  const quoteProtectionValue = quoteTimerActive ? Math.max(0, (quoteTimeLeft / quoteDurationSeconds) * 100) : 0;

  return (
    <Stack
      spacing={2.25}
      sx={{
        '& .MuiInputBase-root': {
          bgcolor: (theme) => alpha(theme.palette.common.white, 0.04),
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
        <Paper component="form" onSubmit={handleSubmit} sx={{ ...bookingPaperSx, p: { xs: 1.75, md: 2.25 } }}>
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
                    borderColor: (theme) => alpha(theme.palette.primary.light, 0.18),
                    px: 1,
                    py: 0.8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    bgcolor: (theme) => alpha(theme.palette.common.white, 0.03),
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
                bgcolor: (theme) => alpha(theme.palette.common.white, 0.06),
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
                    bgcolor: (theme) => alpha(theme.palette.common.white, 0.08),
                  }}
                />
                <Typography variant="body2" color={quoteExpired ? 'error.main' : 'primary.light'} sx={{ flexShrink: 0, minWidth: 88, textAlign: 'right' }}>
                  {!quoteTimerActive ? 'Awaiting' : quoteExpired ? '0s left' : `${quoteTimeLeft}s left`}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {formData.productType !== 'SPOT_FWD'
                  ? 'Quote timing applies to FX Spot/Fwd tickets only. Other product types can be booked with manual pricing.'
                  : quoteTimerActive
                  ? `The streamed price remains bookable for up to ${quoteDurationSeconds} seconds before repricing is required.`
                  : 'Complete all required booking fields to activate quote timing.'}
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Button size="small" type="button" variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={repriceTicket}>
                Refresh quote timer
              </Button>
              <Button size="small" type="submit" variant="contained" startIcon={<DoneAllRoundedIcon />} disabled={isSubmitting || quoteExpired || !isFormComplete} sx={{ minWidth: { sm: 168 } }}>
                {isSubmitting ? 'Booking trade…' : 'Book trade'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

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
