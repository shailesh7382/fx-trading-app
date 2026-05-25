import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { fetchLookup } from '../api/client';
import { fallbackCustomers, fallbackRelationshipManagers, fallbackSales } from '../data/mockData';
import { calculateSettlementDate, formatCurrency, formatNotional, formatRate, getCurrencyCodes } from '../utils/formatters';
import UserContext from './UserContext';

const tenorOptions = ['SP', '1M', '3M', '6M', '1Y'];
const directionOptions = ['Buy', 'Sell'];
const quoteDurationSeconds = 30;

function getMarketPrice(direction, rate) {
  if (!rate) {
    return '';
  }

  return direction === 'Sell' ? String(rate.bid) : String(rate.ask);
}

function buildInitialForm(quote, direction) {
  const today = new Date().toISOString().slice(0, 10);

  return {
    ccyPair: quote?.ccyPair || '',
    tenor: quote?.tenor || 'SP',
    qty: quote?.qty ? String(Math.round(quote.qty)) : '1000000',
    price: getMarketPrice(direction || 'Buy', quote),
    direction: direction || 'Buy',
    dealtCurrency: getCurrencyCodes(quote?.ccyPair).base || '',
    customer: '',
    rm: '',
    sales: '',
    tradeDate: today,
    settlementDate: calculateSettlementDate(today, quote?.tenor || 'SP'),
    comments: '',
  };
}

function FXTradeBooking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userDetails, bookTrade } = useContext(UserContext);
  const { rates, isDemo } = useOutletContext();
  const incomingQuote = location.state?.quote;
  const incomingDirection = location.state?.direction || 'Buy';
  const [formData, setFormData] = useState(() => buildInitialForm(incomingQuote, incomingDirection));
  const [customers, setCustomers] = useState(fallbackCustomers);
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

  const quoteExpired = quoteTimeLeft <= 0;
  const notional = Number(formData.qty || 0) * Number(formData.price || 0);

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
    }

    loadLookups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
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
    const intervalId = window.setInterval(() => {
      setQuoteTimeLeft(Math.max(0, Math.ceil((quoteExpiresAt - Date.now()) / 1000)));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [quoteExpiresAt]);

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

    setFormData((current) => ({
      ...current,
      price: getMarketPrice(current.direction, activeRate),
      tenor: activeRate.tenor,
    }));
    setQuoteExpiresAt(Date.now() + quoteDurationSeconds * 1000);
    setQuoteTimeLeft(quoteDurationSeconds);
    setSeverity('info');
    setMessage('Quote repriced from the latest market snapshot.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.ccyPair || !formData.customer || !formData.rm || !formData.sales || !formData.price) {
      setSeverity('error');
      setMessage('Complete the market, customer, and coverage fields before booking.');
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
        ...formData,
        qty: Number(formData.qty),
        price: Number(formData.price),
        trader: userDetails?.username || 'demo.trader',
        marketSource: activeRate?.source || 'MANUAL',
      });

      setSeverity('success');
      setMessage(`Trade ${bookedTrade.id} booked successfully (${bookedTrade.bookingMode} capture).`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 3 } }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">FX trade booking</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Review market terms, confirm customer coverage, and book into the blotter with a guarded quote timer.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={repriceTicket}>
                Reprice
              </Button>
              <Button variant="text" startIcon={<ReceiptLongRoundedIcon />} onClick={() => navigate('/app/blotter')}>
                View blotter
              </Button>
            </Stack>
          </Stack>

          {message ? <Alert severity={severity}>{message}</Alert> : null}

          <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={isDemo ? 'Demo booking support active' : 'Live booking route available'} color={isDemo ? 'warning' : 'primary'} />
            <Chip label={`Trader: ${userDetails?.username || 'demo.trader'}`} variant="outlined" />
            <Chip label={activeRate ? `${activeRate.ccyPair} ${activeRate.tenor}` : 'Manual ticket'} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(340px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6">1. Market terms</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Pre-filled from the quote card when launched from rates, but still editable for manual workflow.
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              <TextField select label="Currency pair" name="ccyPair" value={formData.ccyPair} onChange={handleFieldChange}>
                {rates.map((rate) => (
                  <MenuItem key={`${rate.ccyPair}-${rate.tenor}`} value={rate.ccyPair}>
                    {rate.ccyPair}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Tenor" name="tenor" value={formData.tenor} onChange={handleFieldChange}>
                {tenorOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Direction" name="direction" value={formData.direction} onChange={handleFieldChange}>
                {directionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Quantity" name="qty" value={formData.qty} onChange={handleFieldChange} type="number" />
              <TextField select label="Dealt currency" name="dealtCurrency" value={formData.dealtCurrency} onChange={handleFieldChange}>
                {dealtCurrencyOptions.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Price" name="price" value={formData.price} onChange={handleFieldChange} type="number" />
              <TextField label="Trade date" name="tradeDate" value={formData.tradeDate} onChange={handleFieldChange} type="date" InputLabelProps={{ shrink: true }} />
              <TextField
                label="Settlement date"
                name="settlementDate"
                value={formData.settlementDate}
                onChange={handleFieldChange}
                type="date"
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box>
              <Typography variant="h6">2. Coverage and comments</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                Capture who owns the relationship and what the trade is solving for the client.
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                <TextField select label="Customer" name="customer" value={formData.customer} onChange={handleFieldChange}>
                  {customers.map((customer) => (
                    <MenuItem key={customer.id} value={customer.name}>
                      {customer.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField select label="Relationship manager" name="rm" value={formData.rm} onChange={handleFieldChange}>
                  {relationshipManagers.map((rm) => (
                    <MenuItem key={rm.id} value={rm.name}>
                      {rm.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField select label="Sales" name="sales" value={formData.sales} onChange={handleFieldChange}>
                  {salesPeople.map((salesPerson) => (
                    <MenuItem key={salesPerson.id} value={salesPerson.name}>
                      {salesPerson.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Box />
                <TextField
                  label="Comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleFieldChange}
                  multiline
                  rows={4}
                  sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}
                />
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between' }}>
              <Button type="button" variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={repriceTicket}>
                Refresh quote timer
              </Button>
              <Button type="submit" variant="contained" startIcon={<DoneAllRoundedIcon />} disabled={isSubmitting || quoteExpired}>
                {isSubmitting ? 'Booking trade…' : 'Book trade'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Stack spacing={2} sx={{ position: { xl: 'sticky' }, top: { xl: 104 } }}>
          <Paper sx={{ p: 2.25 }}>
            <Typography variant="h6">Quote summary</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
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
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.25 }}>
            <Typography variant="h6">Quote protection</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Current ticket holds a {quoteDurationSeconds}-second booking window to make the flow closer to a real dealing desk.
            </Typography>

            <Box sx={{ mt: 1.75 }}>
              <LinearProgress
                variant="determinate"
                value={Math.max(0, (quoteTimeLeft / quoteDurationSeconds) * 100)}
                color={quoteExpired ? 'error' : 'primary'}
              />
              <Typography variant="body2" color={quoteExpired ? 'error.main' : 'text.secondary'} sx={{ mt: 1 }}>
                {quoteExpired ? 'Quote expired. Reprice required.' : `${quoteTimeLeft}s remaining`}
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 2.25 }}>
            <Typography variant="h6">Execution notes</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              If `/api/bookTrade` is unavailable, the ticket still lands in the blotter via resilient local capture so the end-to-end UX remains testable.
            </Typography>
            <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <Chip label={activeRate?.source || 'MANUAL'} size="small" variant="outlined" />
              <Chip label={activeRate?.status || 'READY'} size="small" color={quoteExpired ? 'error' : 'success'} />
              <Chip label={`Settle ${formData.settlementDate}`} size="small" variant="outlined" />
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}

export default FXTradeBooking;
