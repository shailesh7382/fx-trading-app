import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { formatNotional, formatRate, formatSignedDelta } from '../utils/formatters';

function FXMarketAnalysis() {
  const navigate = useNavigate();
  const { rates, isDemo } = useOutletContext();

  const analytics = useMemo(() => {
    const sortedByMove = [...rates].sort((left, right) => Math.abs(right.bidDelta) - Math.abs(left.bidDelta));
    const sortedBySpread = [...rates].sort((left, right) => right.spreadPips - left.spreadPips);
    const deepestLiquidity = [...rates].sort((left, right) => right.qty - left.qty);
    const avgSpread = rates.length
      ? (rates.reduce((sum, rate) => sum + rate.spreadPips, 0) / rates.length).toFixed(1)
      : '0.0';

    return {
      topMover: sortedByMove[0],
      widestSpread: sortedBySpread[0],
      deepestLiquidity: deepestLiquidity[0],
      avgSpread,
      movers: sortedByMove.slice(0, 5),
    };
  }, [rates]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h4">Market analysis</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>
              Surface what matters faster: biggest movers, widest spreads, and the deepest liquidity pockets from the current workspace feed.
            </Typography>
          </Box>
          <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={isDemo ? 'Demo analytics feed' : 'Live market analytics'} color={isDemo ? 'warning' : 'primary'} />
            <Chip label={`${analytics.avgSpread} pips avg spread`} variant="outlined" />
            <Chip label={`${rates.length} instruments monitored`} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {[
          {
            title: 'Top mover',
            value: analytics.topMover?.ccyPair,
            helper: analytics.topMover ? `${formatSignedDelta(analytics.topMover.bidDelta)} bid change` : 'No data',
          },
          {
            title: 'Widest spread',
            value: analytics.widestSpread?.ccyPair,
            helper: analytics.widestSpread ? `${analytics.widestSpread.spreadPips} pips spread` : 'No data',
          },
          {
            title: 'Deepest liquidity',
            value: analytics.deepestLiquidity?.ccyPair,
            helper: analytics.deepestLiquidity ? `${formatNotional(analytics.deepestLiquidity.qty)} available` : 'No data',
          },
        ].map((card) => (
          <Card key={card.title}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {card.title}
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.8 }}>
                {card.value || '—'}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {card.helper}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Movers board
          </Typography>
          <Stack spacing={1.25}>
            {analytics.movers.map((rate) => {
              const positive = rate.bidDelta >= 0;
              const moveStrength = Math.min(100, Math.abs(rate.bidDelta) * (rate.bid > 20 ? 8000 : 800000));

              return (
                <Paper key={`${rate.ccyPair}-${rate.tenor}`} sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle1">
                          {rate.ccyPair} · {rate.tenor}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          Mid {formatRate(rate.mid)} · Spread {rate.spreadPips} pips
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {positive ? <TrendingUpRoundedIcon color="success" /> : <TrendingDownRoundedIcon color="error" />}
                        <Typography color={positive ? 'success.main' : 'error.main'}>{formatSignedDelta(rate.bidDelta)}</Typography>
                      </Stack>
                    </Stack>
                    <LinearProgress variant="determinate" value={moveStrength} color={positive ? 'success' : 'error'} />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        <Stack spacing={2}>
          <Paper sx={{ p: 2.25 }}>
            <Typography variant="h6">Actionable readout</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              <Typography color="text.secondary">
                <strong>{analytics.topMover?.ccyPair || 'The lead pair'}</strong> is showing the strongest directional move. That is a good candidate for a fresh ticket review.
              </Typography>
              <Typography color="text.secondary">
                <strong>{analytics.widestSpread?.ccyPair || 'One pair'}</strong> has the widest spread, so price discipline matters more before booking.
              </Typography>
              <Typography color="text.secondary">
                <strong>{analytics.deepestLiquidity?.ccyPair || 'The deepest pool'}</strong> offers the most size currently visible in the workspace.
              </Typography>
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.25 }}>
            <Typography variant="h6">Next actions</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => navigate('/app/rates')}>
                Review live rate cards
              </Button>
              <Button variant="outlined" onClick={() => navigate('/app/booking', { state: { quote: analytics.topMover, direction: 'Buy' } })}>
                Launch ticket on top mover
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}

export default FXMarketAnalysis;
