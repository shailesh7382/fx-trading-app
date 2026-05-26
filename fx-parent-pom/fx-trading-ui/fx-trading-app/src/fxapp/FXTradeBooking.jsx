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

function getMarketPrice(direction, rate) {
  if (!rate) {
    return '';
  }

  return direction === 'Sell' ? String(rate.bid) : String(rate.ask);
}

function buildInitialForm(quote, direction, launchState = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialTenor = quote?.tenor || 'SP';
  const initialSettlementDate = launchState.valueDate || launchState.settlementDate || calculateSettlementDate(today, initialTenor);
  const launchQuantity = Number.parseInt(String(launchState.qty ?? ''), 10);
  const initialQuantity = Number.isNaN(launchQuantity)
    ? quote?.qty
      ? String(Math.round(quote.qty))
      : '1000000'
    : String(launchQuantity);

  return {
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

      return rates.find((rate) => rate.ccyPair === formData.ccyPair) || incomingQuote || null;
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

    const hasRequiredText = requiredValues.every((value) => String(value || '').trim().length > 0);
    const quantity = Number(formData.qty);
    const price = Number(formData.price);

    return hasRequiredText && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price > 0;
  }, [
    formData.ccyPair,
    formData.comments,
    formData.dealtCurrency,
    formData.direction,
    formData.price,
    formData.qty,
    formData.rm,
    formData.sales,
    formData.settlementDate,
    formData.tenor,
    formData.tradeDate,
  ]);
  const quoteTimerActive = isFormComplete && Boolean(activeRate);
  const quoteExpired = quoteTimerActive && quoteTimeLeft <= 0;

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
        nextValue.price = getMarketPrice(nextValue.direction, nextRate);
      }

      if (name === 'direction') {
        nextValue.price = getMarketPrice(value, activeRate);
      }

      if (name === 'tenor' || name === 'tradeDate') {
        nextValue.settlementDate = calculateSettlementDate(
          name === 'tradeDate' ? value : nextValue.tradeDate,
          name === 'tenor' ? value : nextValue.tenor
        );
      }

      return nextValue;
    });
  };

  const repriceTicket = () => {
    if (!activeRate) {
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
        ...formData,
        qty: Number(formData.qty),
        price: Number(formData.price),
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

            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              <TextField size="small" select label="Currency pair" name="ccyPair" value={formData.ccyPair} onChange={handleFieldChange}>
                {rates.map((rate) => (
                  <MenuItem key={`${rate.ccyPair}-${rate.tenor}`} value={rate.ccyPair}>
                    {rate.ccyPair}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" select label="Tenor" name="tenor" value={formData.tenor} onChange={handleFieldChange}>
                {tenorOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" select label="Direction" name="direction" value={formData.direction} onChange={handleFieldChange}>
                {directionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Quantity" name="qty" value={formData.qty} onChange={handleFieldChange} type="number" />
              <TextField size="small" select label="Dealt currency" name="dealtCurrency" value={formData.dealtCurrency} onChange={handleFieldChange}>
                {dealtCurrencyOptions.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Price" name="price" value={formData.price} onChange={handleFieldChange} type="number" />
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
                label="Settlement date"
                name="settlementDate"
                value={formData.settlementDate}
                onChange={handleFieldChange}
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
              />
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
                {quoteTimerActive
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
                <Typography color="text.secondary">Pair</Typography>
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
                <Typography>{activeRate ? formatRate(formData.price) : 'Manual'}</Typography>
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
