import React, { useContext, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UserContext from './UserContext';
import { downloadCsv } from '../utils/export';
import { formatCurrency, formatDateTime, formatNotional } from '../utils/formatters';

function FXTradeBlotter() {
  const { trades } = useContext(UserContext);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const visibleTrades = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();

    return trades.filter((trade) => {
      const matchesStatus = statusFilter === 'ALL' ? true : trade.bookingMode === statusFilter;
      const matchesSearch = loweredSearch
        ? [trade.ccyPair, trade.customer, trade.trader, trade.id].some((value) =>
            String(value || '').toLowerCase().includes(loweredSearch)
          )
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, trades]);

  const metrics = useMemo(() => {
    const grossNotional = visibleTrades.reduce((sum, trade) => sum + Number(trade.qty || 0) * Number(trade.price || 0), 0);
    const buyCount = visibleTrades.filter((trade) => trade.direction === 'Buy').length;
    const localFallbacks = visibleTrades.filter((trade) => trade.bookingMode === 'local').length;

    return {
      grossNotional,
      buyCount,
      sellCount: visibleTrades.length - buyCount,
      localFallbacks,
    };
  }, [visibleTrades]);

  const exportBlotter = () => {
    downloadCsv(
      'fx-trade-blotter.csv',
      visibleTrades.map((trade) => ({
        TradeId: trade.id,
        Pair: trade.ccyPair,
        Direction: trade.direction,
        Tenor: trade.tenor,
        Quantity: trade.qty,
        Price: trade.price,
        Customer: trade.customer,
        RM: trade.rm,
        Sales: trade.sales,
        Trader: trade.trader,
        TradeDate: trade.tradeDate,
        SettlementDate: trade.settlementDate,
        BookingMode: trade.bookingMode,
        Status: trade.status,
        BookedAt: trade.bookedAt,
      }))
    );
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">Trade blotter</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Review booked trades, distinguish live vs resilient local capture, and keep the execution trail readable on mobile.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={exportBlotter}>
              Export blotter
            </Button>
          </Stack>

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1.4fr 0.8fr' } }}>
            <TextField
              label="Search trades"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="EURUSD, Northwind, FX-240..."
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon color="action" />
                      </InputAdornment>
                    ),
                  },
              }}
            />
            <TextField select label="Booking mode" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <MenuItem value="ALL">All captures</MenuItem>
              <MenuItem value="live">Live capture</MenuItem>
              <MenuItem value="local">Local fallback</MenuItem>
            </TextField>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            {[
              { label: 'Visible trades', value: visibleTrades.length, helper: `${trades.length} total stored` },
              { label: 'Gross notional', value: formatCurrency(metrics.grossNotional), helper: 'Approx. USD equivalent' },
              { label: 'Buy / Sell mix', value: `${metrics.buyCount} / ${metrics.sellCount}`, helper: 'Directional split' },
              { label: 'Fallback captures', value: metrics.localFallbacks, helper: 'Tickets stored locally when API is offline' },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {metric.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.8 }}>
                    {metric.value}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
                    {metric.helper}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {visibleTrades.map((trade) => (
          <Paper key={trade.id} sx={{ p: { xs: 2, md: 2.25 } }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(260px, 0.7fr)' },
                alignItems: 'start',
              }}
            >
              <Stack spacing={1.2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h5">
                      {trade.direction} {trade.ccyPair}
                    </Typography>
                    <Typography color="text.secondary">
                      {trade.customer} · {trade.tenor} · {formatNotional(trade.qty)} · {trade.dealtCurrency}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip label={trade.status} color="success" size="small" />
                    <Chip label={trade.bookingMode === 'live' ? 'Live capture' : 'Local fallback'} color={trade.bookingMode === 'live' ? 'primary' : 'warning'} size="small" />
                  </Stack>
                </Stack>

                <Typography color="text.secondary">{trade.comments || 'No additional execution comments captured.'}</Typography>

                <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
                  <Chip label={`Trader ${trade.trader}`} variant="outlined" size="small" />
                  <Chip label={`RM ${trade.rm}`} variant="outlined" size="small" />
                  <Chip label={`Sales ${trade.sales}`} variant="outlined" size="small" />
                </Stack>
              </Stack>

              <Paper sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Trade ID</Typography>
                    <Typography>{trade.id}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Price</Typography>
                    <Typography>{trade.price}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Notional</Typography>
                    <Typography>{formatCurrency(Number(trade.qty || 0) * Number(trade.price || 0))}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Booked at</Typography>
                    <Typography>{formatDateTime(trade.bookedAt)}</Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Box>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

export default FXTradeBlotter;
