import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { downloadCsv } from '../utils/export';
import { formatNotional, formatRate, formatRelativeTime, formatSignedDelta } from '../utils/formatters';

const tenorOptions = ['ALL', 'SP', '1M', '3M', '6M', '1Y'];

function deltaIcon(delta) {
  if (delta > 0) return <TrendingUpRoundedIcon fontSize="small" color="success" />;
  if (delta < 0) return <TrendingDownRoundedIcon fontSize="small" color="error" />;
  return <TrendingFlatRoundedIcon fontSize="small" color="disabled" />;
}

function FXRateGrid() {
  const navigate = useNavigate();
  const { rates, isDemo, error, isLoading, lastUpdated, refresh } = useOutletContext();
  const [search, setSearch] = useState('');
  const [tenorFilter, setTenorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('pair');

  const filteredRates = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();

    return [...rates]
      .filter((rate) => (tenorFilter === 'ALL' ? true : rate.tenor === tenorFilter))
      .filter((rate) => (loweredSearch ? rate.ccyPair.toLowerCase().includes(loweredSearch) : true))
      .sort((left, right) => {
        if (sortBy === 'spread') return left.spreadPips - right.spreadPips;
        if (sortBy === 'updated') return new Date(right.updatedAt) - new Date(left.updatedAt);
        if (sortBy === 'move') return Math.abs(right.bidDelta) - Math.abs(left.bidDelta);
        return left.ccyPair.localeCompare(right.ccyPair);
      });
  }, [rates, search, sortBy, tenorFilter]);

  const downloadExcel = () => {
    downloadCsv(
      'fx-rates-workspace.csv',
      filteredRates.map((rate) => ({
        Pair: rate.ccyPair,
        Tenor: rate.tenor,
        Quantity: rate.qty,
        Bid: rate.bid,
        Ask: rate.ask,
        SpreadPips: rate.spreadPips,
        Source: rate.source,
        Status: rate.status,
        UpdatedAt: rate.updatedAt,
      }))
    );
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2.25}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', lg: 'center' },
            }}
          >
            <Box>
              <Typography variant="h4">FX rate grid</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Tap-friendly quote cards replace the old dense grid while keeping instant booking and export nearby.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button variant="outlined" startIcon={<SyncRoundedIcon />} onClick={refresh}>
                Refresh rates
              </Button>
              <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={downloadExcel}>
                Export view
              </Button>
            </Stack>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={isDemo ? 'Demo liquidity feed' : 'Connected to live pricing'} color={isDemo ? 'warning' : 'primary'} />
            <Chip label={`${filteredRates.length} instruments visible`} variant="outlined" />
            <Chip label={`Updated ${formatRelativeTime(lastUpdated)}`} variant="outlined" />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))', xl: '1.2fr 0.8fr 0.8fr' },
            }}
          >
            <TextField
              label="Search pair"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="EURUSD"
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
            <TextField select label="Tenor" value={tenorFilter} onChange={(event) => setTenorFilter(event.target.value)}>
              {tenorOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Sort by" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <MenuItem value="pair">Currency pair</MenuItem>
              <MenuItem value="move">Largest move</MenuItem>
              <MenuItem value="spread">Tightest spread</MenuItem>
              <MenuItem value="updated">Latest refresh</MenuItem>
            </TextField>
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {filteredRates.map((rate) => (
          <Card key={`${rate.ccyPair}-${rate.tenor}`}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5">{rate.ccyPair}</Typography>
                    <Typography color="text.secondary">
                      {rate.tenor} · {formatNotional(rate.qty)} available · {formatRelativeTime(rate.updatedAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip label={rate.source} size="small" variant="outlined" />
                    <Chip label={rate.status} size="small" color={rate.status === 'LIVE' ? 'success' : 'warning'} />
                  </Stack>
                </Stack>

                <Paper sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Mid / spread
                      </Typography>
                      <Typography variant="h4">{formatRate(rate.mid)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" color="text.secondary">
                        Spread
                      </Typography>
                      <Typography variant="h6">{rate.spreadPips} pips</Typography>
                    </Box>
                  </Stack>
                </Paper>

                <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                  <Paper sx={{ p: 1.5, bgcolor: 'rgba(255, 107, 129, 0.08)' }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Bid / Sell base
                        </Typography>
                        <Typography variant="h4">{formatRate(rate.bid)}</Typography>
                      </Box>
                      {deltaIcon(rate.bidDelta)}
                    </Stack>
                    <Typography variant="caption" color={rate.bidDelta >= 0 ? 'success.main' : 'error.main'}>
                      {formatSignedDelta(rate.bidDelta)}
                    </Typography>
                    <Button
                      fullWidth
                      color="error"
                      variant="outlined"
                      sx={{ mt: 1.25 }}
                      onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Sell' } })}
                    >
                      Sell at bid
                    </Button>
                  </Paper>

                  <Paper sx={{ p: 1.5, bgcolor: 'rgba(43, 213, 118, 0.08)' }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Ask / Buy base
                        </Typography>
                        <Typography variant="h4">{formatRate(rate.ask)}</Typography>
                      </Box>
                      {deltaIcon(rate.askDelta)}
                    </Stack>
                    <Typography variant="caption" color={rate.askDelta >= 0 ? 'success.main' : 'error.main'}>
                      {formatSignedDelta(rate.askDelta)}
                    </Typography>
                    <Button
                      fullWidth
                      color="success"
                      variant="contained"
                      sx={{ mt: 1.25 }}
                      onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Buy' } })}
                    >
                      Buy at ask
                    </Button>
                  </Paper>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    This streamlined card layout preserves the trading intent while being more usable on tablets and phones.
                  </Typography>
                  <Button variant="text" onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Buy' } })}>
                    Open trade ticket
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {!filteredRates.length && !isLoading ? (
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
