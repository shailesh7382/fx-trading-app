import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigate, useOutletContext } from 'react-router-dom';
import { fetchFxGrid } from '../api/client';
import { downloadCsv } from '../utils/export';
import { formatRelativeTime, getRateDisplayParts } from '../utils/formatters';

const flashDurationMs = 900;

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
  const { rates, isDemo, error, isLoading, lastUpdated, refresh } = useOutletContext();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('pair');
  const maxVisibleRates = 6;
  const [serverRates, setServerRates] = useState([]);
  const [gridRequestFailed, setGridRequestFailed] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const previousRatesRef = useRef(new Map());
  const [flashSignals, setFlashSignals] = useState({});

  const fallbackRates = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();

    return [...rates]
      .filter((rate) => (loweredSearch ? rate.ccyPair.toLowerCase().includes(loweredSearch) : true))
      .sort((left, right) => {
        if (sortBy === 'updated') return new Date(right.updatedAt) - new Date(left.updatedAt);
        return left.ccyPair.localeCompare(right.ccyPair);
      });
  }, [rates, search, sortBy]);

  useEffect(() => {
    let isMounted = true;
    let loadTimer;

    async function loadGridRates() {
      setIsGridLoading(true);

      try {
        const data = await fetchFxGrid({
          search,
          sort: sortBy,
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
  }, [maxVisibleRates, search, sortBy, lastUpdated]);

  const visibleRates = gridRequestFailed ? fallbackRates.slice(0, maxVisibleRates) : serverRates;

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

  const downloadExcel = () => {
    downloadCsv(
      'fx-rates-workspace.csv',
      visibleRates.map((rate) => ({
        Pair: rate.ccyPair,
        Tenor: rate.tenor,
        Quantity: rate.qty,
        Bid: rate.bid,
        Ask: rate.ask,
        Source: rate.source,
        Status: rate.status,
        UpdatedAt: rate.updatedAt,
      }))
    );
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 1.25, md: 1.5 } }}>
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'stretch', xl: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" label={isDemo ? 'Demo feed' : 'Live feed'} color={isDemo ? 'warning' : 'primary'} />
            <Chip size="small" label={`${visibleRates.length} instruments`} variant="outlined" />
            <Chip size="small" label={`Updated ${formatRelativeTime(lastUpdated)}`} variant="outlined" />
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'stretch', md: 'center' }, flexShrink: 0 }}
          >
            <TextField
              size="small"
              label="Search pair"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="EURUSD"
              sx={{ minWidth: { md: 220 } }}
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
            <TextField size="small" select label="Sort by" value={sortBy} onChange={(event) => setSortBy(event.target.value)} sx={{ minWidth: { md: 180 } }}>
              <MenuItem value="pair">Currency pair</MenuItem>
              <MenuItem value="updated">Latest refresh</MenuItem>
            </TextField>
            <Button size="small" variant="outlined" startIcon={<SyncRoundedIcon />} onClick={refresh}>
              Refresh
            </Button>
            <Button size="small" variant="contained" startIcon={<DownloadRoundedIcon />} onClick={downloadExcel}>
              Export
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert> : null}
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {visibleRates.map((rate) => (
          <Card key={`${rate.ccyPair}-${rate.tenor}`} sx={{ borderRadius: 1 }}>
            <CardContent sx={{ p: { xs: 1.5, md: 1.75 }, '&:last-child': { pb: { xs: 1.5, md: 1.75 } } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" sx={{ letterSpacing: '0.08em', fontWeight: 700 }}>
                      {rate.ccyPair}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Paper sx={getQuoteTileStyles('rgba(255, 107, 129, 0.08)', flashSignals[`${rate.ccyPair}-${rate.tenor}`]?.bid)}>
                    <RateDisplay value={rate.bid} accentColor="error.main" />
                    <Button
                      fullWidth
                      color="error"
                      variant="outlined"
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700 }}
                      onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Sell' } })}
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
                      onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Buy' } })}
                    >
                      Buy
                    </Button>
                  </Paper>
                </Box>

              </Stack>
            </CardContent>
          </Card>
        ))}
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
