import { useMemo } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceContext } from '@/features/workspace/useWorkspaceData';
import type { NormalizedRate } from '@/shared/types';
import { formatRate, formatRelativeTime } from '@/shared/utils/formatters';
import { DivergingBarChart, MagnitudeBarChart } from './Charts';
import type { ChartDatum } from './Charts';
import {
  chartTokens,
  formatPipValue,
  formatQuantity,
  formatSignedPips,
  getMovePips,
  monoFont,
} from './presentation';

const maxChartRows = 8;

function StatTile({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  accent?: string;
}) {
  return (
    <Paper
      sx={{
        px: { xs: 1.25, md: 2 },
        py: { xs: 1, md: 1.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.35,
        borderLeft: accent ? '3px solid' : undefined,
        borderLeftColor: accent,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.4rem' }, fontWeight: 650, lineHeight: 1.15 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
        {caption}
      </Typography>
    </Paper>
  );
}

function buildTooltip(rate: NormalizedRate) {
  const movePips = getMovePips(rate);

  return (
    <Box sx={{ py: 0.25 }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
        {rate.ccyPair} · {rate.tenor}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        Bid {formatRate(rate.bid)} / Ask {formatRate(rate.ask)}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        Spread {formatPipValue(rate.spreadPips)} pips · Move {formatSignedPips(movePips)} pips
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        Size {formatQuantity(rate.qty)} · {formatRelativeTime(rate.updatedAt)}
      </Typography>
    </Box>
  );
}

function MarketAnalysis() {
  const navigate = useNavigate();
  const { rates, isDemo, lastUpdated } = useWorkspaceContext();

  const analytics = useMemo(() => {
    if (!rates.length) {
      return null;
    }

    const byMove = [...rates].sort((left, right) => Math.abs(getMovePips(right)) - Math.abs(getMovePips(left)));
    const bySpread = [...rates].sort((left, right) => left.spreadPips - right.spreadPips);
    const bySize = [...rates].sort((left, right) => right.qty - left.qty);
    const averageSpread = rates.reduce((total, rate) => total + rate.spreadPips, 0) / rates.length;
    const advancing = rates.filter((rate) => getMovePips(rate) > 0).length;
    const declining = rates.filter((rate) => getMovePips(rate) < 0).length;

    return {
      topMover: byMove[0],
      tightest: bySpread[0],
      widest: bySpread[bySpread.length - 1],
      deepest: bySize[0],
      averageSpread,
      advancing,
      declining,
      movers: byMove.filter((rate) => getMovePips(rate) !== 0).slice(0, maxChartRows),
      spreads: bySpread.slice(0, maxChartRows),
    };
  }, [rates]);

  const moverData: ChartDatum[] = useMemo(
    () =>
      (analytics?.movers || []).map((rate) => ({
        key: `${rate.ccyPair}-${rate.tenor}`,
        label: `${rate.ccyPair} ${rate.tenor}`,
        value: getMovePips(rate),
        tooltip: buildTooltip(rate),
      })),
    [analytics]
  );

  const spreadData: ChartDatum[] = useMemo(
    () =>
      (analytics?.spreads || []).map((rate) => ({
        key: `${rate.ccyPair}-${rate.tenor}`,
        label: `${rate.ccyPair} ${rate.tenor}`,
        value: rate.spreadPips,
        tooltip: buildTooltip(rate),
      })),
    [analytics]
  );

  const tableRows = useMemo(
    () =>
      [...rates].sort(
        (left, right) =>
          left.ccyPair.localeCompare(right.ccyPair) || left.tenor.localeCompare(right.tenor)
      ),
    [rates]
  );

  if (!analytics) {
    return (
      <Paper sx={{ px: 3, py: { xs: 5, md: 8 }, textAlign: 'center' }}>
        <InsightsRoundedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          No market data yet
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          Analytics appear once the pricing service publishes its first quotes.
        </Typography>
      </Paper>
    );
  }

  const topMoverPips = getMovePips(analytics.topMover);

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <Paper
        sx={{
          px: { xs: 1.5, md: 2 },
          py: { xs: 1, md: 1.15 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, flexWrap: 'wrap', rowGap: 0.5 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: isDemo ? '#B3801F' : chartTokens.up,
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            {isDemo ? 'Demo feed' : 'Live analytics'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
            · {rates.length} instruments · {analytics.advancing} up / {analytics.declining} down · updated{' '}
            {formatRelativeTime(lastUpdated)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => navigate('/app/rates')}>
            Review rates
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() =>
              navigate('/app/booking', { state: { quote: analytics.topMover, direction: 'Buy' } })
            }
          >
            Ticket top mover
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1, md: 1.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <StatTile
          label="Average spread"
          value={`${formatPipValue(analytics.averageSpread)} pips`}
          caption={`Across ${rates.length} quotes`}
          accent={chartTokens.magnitude}
        />
        <StatTile
          label="Tightest"
          value={analytics.tightest.ccyPair}
          caption={`${formatPipValue(analytics.tightest.spreadPips)} pips · ${analytics.tightest.tenor}`}
          accent={chartTokens.up}
        />
        <StatTile
          label="Widest"
          value={analytics.widest.ccyPair}
          caption={`${formatPipValue(analytics.widest.spreadPips)} pips · ${analytics.widest.tenor}`}
          accent="#B3801F"
        />
        <StatTile
          label="Largest move"
          value={analytics.topMover.ccyPair}
          caption={
            topMoverPips
              ? `${formatSignedPips(topMoverPips)} pips since last tick`
              : 'Flat since last tick'
          }
          accent={topMoverPips >= 0 ? chartTokens.up : chartTokens.down}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          alignItems: 'start',
        }}
      >
        <Paper>
          <DivergingBarChart
            title="Session moves"
            subtitle="Bid change since the previous tick, largest first"
            unit="pips"
            data={moverData}
            emptyMessage="No instrument has moved since the last tick."
          />
        </Paper>

        <Paper>
          <MagnitudeBarChart
            title="Spread by instrument"
            subtitle="Bid/ask spread, tightest first"
            unit="pips"
            data={spreadData}
            emptyMessage="No spreads to compare yet."
          />
        </Paper>
      </Box>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 1.5, md: 2 }, pt: { xs: 1.5, md: 2 }, pb: 1 }}>
          <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700 }}>
            All instruments
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Every quote behind the charts above
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                {['Instrument', 'Bid', 'Ask', 'Mid', 'Spread', 'Move', 'Size', 'Updated'].map((heading, index) => (
                  <TableCell
                    key={heading}
                    align={index > 0 && index < 7 ? 'right' : 'left'}
                    sx={{
                      bgcolor: 'background.default',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                      py: 1,
                    }}
                  >
                    {heading}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((rate) => {
                const movePips = getMovePips(rate);

                return (
                  <TableRow key={`${rate.ccyPair}-${rate.tenor}`} hover sx={{ '& > td': { borderColor: 'divider' } }}>
                    <TableCell sx={{ py: 0.9 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                        {rate.ccyPair}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rate.tenor} · {rate.source}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums', fontFamily: monoFont }}>
                      {formatRate(rate.bid)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums', fontFamily: monoFont }}>
                      {formatRate(rate.ask)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums', fontFamily: monoFont }}>
                      {formatRate(rate.mid)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums' }}>
                      {formatPipValue(rate.spreadPips)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      <Box
                        component="span"
                        aria-hidden
                        sx={{
                          mr: 0.5,
                          fontSize: '0.6rem',
                          color: movePips >= 0 ? chartTokens.up : chartTokens.down,
                        }}
                      >
                        {movePips === 0 ? '·' : movePips > 0 ? '▲' : '▼'}
                      </Box>
                      {formatSignedPips(movePips)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.9, fontVariantNumeric: 'tabular-nums' }}>
                      {formatQuantity(rate.qty)}
                    </TableCell>
                    <TableCell sx={{ py: 0.9, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatRelativeTime(rate.updatedAt)}</Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}

export default MarketAnalysis;
