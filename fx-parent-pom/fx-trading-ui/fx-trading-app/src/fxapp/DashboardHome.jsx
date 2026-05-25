import React, { useContext, useMemo } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import InsightsIcon from '@mui/icons-material/Insights';
import ListAltIcon from '@mui/icons-material/ListAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useNavigate, useOutletContext } from 'react-router-dom';
import UserContext from './UserContext';
import { formatCurrency, formatDateTime, formatNotional, formatRelativeTime, formatSignedDelta } from '../utils/formatters';

const workflowSteps = [
  {
    title: '1. Watch the market',
    description: 'Scan mobile-friendly live cards, spreads, and liquidity tiers before you commit.',
  },
  {
    title: '2. Launch a ticket',
    description: 'Open a pre-filled trade ticket from a live quote and validate the customer stack in one flow.',
  },
  {
    title: '3. Monitor execution',
    description: 'Review booked trades, follow coverage ownership, and keep portfolio exposure in check.',
  },
];

function DashboardHome() {
  const navigate = useNavigate();
  const { userDetails, trades } = useContext(UserContext);
  const { rates, isDemo, error, lastUpdated } = useOutletContext();

  const marketSnapshot = useMemo(() => {
    const spreads = rates.map((rate) => rate.spreadPips);
    const avgSpread = spreads.length
      ? (spreads.reduce((sum, value) => sum + value, 0) / spreads.length).toFixed(1)
      : '0.0';

    const topMover = rates.reduce(
      (currentWinner, rate) =>
        Math.abs(rate.bidDelta) > Math.abs(currentWinner.bidDelta || 0) ? rate : currentWinner,
      rates[0] || { ccyPair: 'N/A', bidDelta: 0 }
    );

    const bookedToday = trades.filter((trade) => trade.tradeDate === new Date().toISOString().slice(0, 10)).length;
    const grossNotional = trades.reduce((sum, trade) => sum + Number(trade.qty || 0) * Number(trade.price || 0), 0);

    return {
      avgSpread,
      topMover,
      bookedToday,
      grossNotional,
    };
  }, [rates, trades]);

  const recentTrades = trades.slice(0, 3);
  const rateHighlights = rates.slice(0, 4);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 3 }, overflow: 'hidden', position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top right, rgba(78, 242, 194, 0.22), transparent 34%), radial-gradient(circle at bottom left, rgba(110, 168, 255, 0.2), transparent 25%)',
            pointerEvents: 'none',
          }}
        />
        <Stack spacing={2.5} sx={{ position: 'relative' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <Box>
              <Chip
                icon={<BoltIcon />}
                label={isDemo ? 'Demo-powered workspace' : 'Live trading workspace'}
                color={isDemo ? 'warning' : 'primary'}
                sx={{ mb: 1.5 }}
              />
              <Typography variant="h4" sx={{ mb: 1 }}>
                Next best action for {userDetails?.username}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
                The UI has been rebuilt around a clearer trading path: monitor liquidity, open a structured ticket,
                and follow through in the blotter and portfolio panels without losing mobile usability.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} width={{ xs: '100%', md: 'auto' }}>
              <Button variant="contained" onClick={() => navigate('/app/rates')} startIcon={<CandlestickChartIcon />}>
                Open live rates
              </Button>
              <Button variant="outlined" onClick={() => navigate('/app/booking')} startIcon={<InsightsIcon />}>
                New trade ticket
              </Button>
            </Stack>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            {[
              { label: 'Streaming pairs', value: rates.length, helper: `Last sync ${formatRelativeTime(lastUpdated)}` },
              { label: 'Booked today', value: marketSnapshot.bookedToday, helper: `${trades.length} total trades in view` },
              { label: 'Average spread', value: `${marketSnapshot.avgSpread} pips`, helper: 'Across current visible instruments' },
              { label: 'Gross notional', value: formatCurrency(marketSnapshot.grossNotional), helper: 'Approx. USD equivalent' },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {metric.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {metric.helper}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: '1.35fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 2.25 }}>
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Comprehensive UX flow</Typography>
            <Chip label="Mobile-first" color="secondary" variant="outlined" />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {workflowSteps.map((step) => (
              <Card key={step.title} sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    {step.title}
                  </Typography>
                  <Typography color="text.secondary">{step.description}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Market pulse
          </Typography>
          <List disablePadding>
            {rateHighlights.map((rate) => (
              <ListItem
                key={rate.ccyPair}
                disableGutters
                secondaryAction={
                  <Button size="small" variant="text" onClick={() => navigate('/app/booking', { state: { quote: rate, direction: 'Buy' } })}>
                    Ticket
                  </Button>
                }
                sx={{ py: 1.25 }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'rgba(78, 242, 194, 0.12)', color: 'primary.main' }}>
                    {rate.ccyPair.slice(0, 1)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`${rate.ccyPair} · ${rate.tenor}`}
                  secondary={`${formatNotional(rate.qty)} available · Spread ${rate.spreadPips} pips · ${formatRelativeTime(rate.updatedAt)}`}
                />
                <Stack spacing={0.25} sx={{ pr: 8, alignItems: 'flex-end' }}>
                  <Typography variant="body1">{rate.ask.toFixed(rate.ask > 20 ? 3 : 5)}</Typography>
                  <Typography variant="caption" color={rate.bidDelta >= 0 ? 'success.main' : 'error.main'}>
                    {formatSignedDelta(rate.bidDelta)}
                  </Typography>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>

        <Stack spacing={2}>
          <Paper sx={{ p: 2.25 }}>
            <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Top mover</Typography>
              <TrendingUpIcon color={marketSnapshot.topMover?.bidDelta >= 0 ? 'success' : 'error'} />
            </Stack>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              {marketSnapshot.topMover?.ccyPair || 'N/A'}
            </Typography>
            <Typography color={marketSnapshot.topMover?.bidDelta >= 0 ? 'success.main' : 'error.main'}>
              {formatSignedDelta(marketSnapshot.topMover?.bidDelta)} bid move on the latest refresh.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.25 }}>
              Use the live rate grid to reprice instantly and launch a ticket with the latest market direction.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2.25 }}>
            <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Recent blotter activity</Typography>
              <Button size="small" variant="text" startIcon={<ListAltIcon />} onClick={() => navigate('/app/blotter')}>
                Full blotter
              </Button>
            </Stack>
            <Stack spacing={1.25}>
              {recentTrades.map((trade) => (
                <Card key={trade.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle1">
                          {trade.direction} {trade.ccyPair}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {trade.customer} · {formatNotional(trade.qty)} · {trade.tenor}
                        </Typography>
                      </Box>
                      <Chip label={trade.bookingMode === 'live' ? 'Live' : 'Local fallback'} color={trade.bookingMode === 'live' ? 'primary' : 'warning'} size="small" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {formatDateTime(trade.bookedAt)}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}

export default DashboardHome;


