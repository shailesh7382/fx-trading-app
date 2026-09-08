import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import { useLocation } from 'react-router-dom';
import { useUser } from '@/features/auth/UserProvider';
import { downloadCsv } from '@/shared/utils/csv';
import { formatCurrency, formatDateTime, formatNotional, formatRate } from '@/shared/utils/formatters';

const productTypeLabels: Record<string, string> = {
  SPOT_FWD: 'FX Spot/Fwd',
  SWAP: 'FX Swap',
  NDF: 'NDFs',
  BULLION: 'Bullion',
};

function TradeBlotter() {
  const { trades } = useUser();
  const location = useLocation();
  const bookedTradeId = (location.state as { bookedTradeId?: string } | null)?.bookedTradeId || '';
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

  const exportBlotter = () => {
    downloadCsv(
      'fx-trade-blotter.csv',
      visibleTrades.map((trade) => ({
        TradeId: trade.id,
        Pair: trade.ccyPair,
        ProductType: productTypeLabels[trade.productType || ''] || trade.productType || 'FX Spot/Fwd',
        ProductDetails: trade.productDetails || '',
          ExecutionType: trade.executionType || 'MARKET',
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
      {bookedTradeId ? <Alert severity="success">Trade {bookedTradeId} booked.</Alert> : null}

      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">Trade blotter</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Booked trades and execution history.
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

        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {visibleTrades.map((trade) => (
          <Paper
            key={trade.id}
            sx={{
              p: { xs: 2, md: 2.25 },
              ...(trade.id === bookedTradeId
                ? { border: '1px solid', borderColor: 'success.main' }
                : null),
            }}
          >
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
                      {trade.customer || 'Desk order'} · {trade.tenor} · {formatNotional(trade.qty)} · {trade.dealtCurrency}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {trade.id === bookedTradeId ? <Chip label="Just booked" color="success" size="small" /> : null}
                    <Chip label={trade.status} color="success" size="small" />
                    <Chip label="Simulator" color="primary" size="small" />
                    <Chip label={trade.executionType === 'LIMIT' ? 'Limit executed' : 'Market ticket'} size="small" variant="outlined" />
                    <Chip label={productTypeLabels[trade.productType || ''] || trade.productType || 'FX Spot/Fwd'} size="small" variant="outlined" />
                  </Stack>
                </Stack>

                <Typography color="text.secondary">
                  {trade.productDetails ? `${trade.productDetails} · ` : ''}
                  {trade.comments || 'No comments.'}
                </Typography>

                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`Trader ${trade.trader}`} variant="outlined" size="small" />
                  <Chip label={`RM ${trade.rm || 'N/A'}`} variant="outlined" size="small" />
                  <Chip label={`Sales ${trade.sales || 'N/A'}`} variant="outlined" size="small" />
                </Stack>
              </Stack>

              <Paper sx={{ p: 1.5, bgcolor: 'background.default' }}>
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
                    <Typography color="text.secondary">Cover / swap</Typography>
                    <Typography>{formatRate(trade.coverPrice)} / {trade.swapPoints ?? 0}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                    <Typography color="text.secondary">Settlement</Typography>
                    <Typography sx={{ textAlign: 'right' }}>
                      Buy {formatNotional(trade.buyQuantity || 0)} {trade.buyCurrency} · Sell {formatNotional(trade.sellQuantity || 0)} {trade.sellCurrency}
                    </Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                    <Typography color="text.secondary">Quote ID</Typography>
                    <Typography sx={{ fontFamily: 'monospace', textAlign: 'right' }}>{trade.quoteId || '—'}</Typography>
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

export default TradeBlotter;
