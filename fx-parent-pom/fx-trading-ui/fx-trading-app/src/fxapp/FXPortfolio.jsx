import React, { useContext, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import UserContext from './UserContext';
import { formatCurrency, formatNotional, getCurrencyCodes } from '../utils/formatters';

function FXPortfolio() {
  const { trades } = useContext(UserContext);

  const portfolio = useMemo(() => {
    const exposures = {};
    const customerTotals = {};
    let grossUsd = 0;

    trades.forEach((trade) => {
      const { base, terms } = getCurrencyCodes(trade.ccyPair);
      const quantity = Number(trade.qty || 0);
      const price = Number(trade.price || 0);
      const directionMultiplier = trade.direction === 'Buy' ? 1 : -1;

      exposures[base] = (exposures[base] || 0) + directionMultiplier * quantity;
      exposures[terms] = (exposures[terms] || 0) - directionMultiplier * quantity * price;

      const usdEquivalent = quantity * price;
      grossUsd += usdEquivalent;
      customerTotals[trade.customer] = (customerTotals[trade.customer] || 0) + usdEquivalent;
    });

    const rankedExposures = Object.entries(exposures)
      .map(([currency, value]) => ({ currency, value }))
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));

    const rankedCustomers = Object.entries(customerTotals)
      .map(([customer, value]) => ({ customer, value }))
      .sort((left, right) => right.value - left.value);

    return {
      grossUsd,
      rankedExposures,
      rankedCustomers,
    };
  }, [trades]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Typography variant="h4">Portfolio overview</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
          Exposure is calculated directly from the current blotter so traders can quickly assess gross risk, top currencies, and customer concentration.
        </Typography>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {[
          { label: 'Stored trades', value: trades.length, helper: 'Current blotter depth' },
          { label: 'Gross USD equivalent', value: formatCurrency(portfolio.grossUsd), helper: 'Approximate portfolio size' },
          {
            label: 'Largest exposure',
            value: portfolio.rankedExposures[0]?.currency || '—',
            helper: portfolio.rankedExposures[0] ? formatNotional(Math.abs(portfolio.rankedExposures[0].value)) : 'No booked flow',
          },
          {
            label: 'Top customer',
            value: portfolio.rankedCustomers[0]?.customer || '—',
            helper: portfolio.rankedCustomers[0] ? formatCurrency(portfolio.rankedCustomers[0].value) : 'No booked flow',
          },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {metric.label}
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.8 }}>
                {metric.value}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {metric.helper}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Currency exposures
          </Typography>
          <Stack spacing={1.5}>
            {portfolio.rankedExposures.map((exposure) => {
              const ratio = portfolio.rankedExposures[0]
                ? Math.min(100, (Math.abs(exposure.value) / Math.abs(portfolio.rankedExposures[0].value || 1)) * 100)
                : 0;

              return (
                <Paper key={exposure.currency} sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack spacing={0.9}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1">{exposure.currency}</Typography>
                      <Typography color={exposure.value >= 0 ? 'success.main' : 'error.main'}>
                        {exposure.value >= 0 ? '+' : '-'}{formatNotional(Math.abs(exposure.value))}
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={ratio} color={exposure.value >= 0 ? 'success' : 'error'} />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.25 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Customer concentration
          </Typography>
          <Stack spacing={1.25}>
            {portfolio.rankedCustomers.map((customer) => {
              const ratio = portfolio.rankedCustomers[0]
                ? Math.min(100, (customer.value / (portfolio.rankedCustomers[0].value || 1)) * 100)
                : 0;

              return (
                <Paper key={customer.customer} sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack spacing={0.9}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1">{customer.customer}</Typography>
                      <Typography>{formatCurrency(customer.value)}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={ratio} color="secondary" />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

export default FXPortfolio;
