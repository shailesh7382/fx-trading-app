import { Box, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import type { Direction } from '@/shared/types';
import { formatCurrency, formatRate } from '@/shared/utils/formatters';
import { formatQuantity, getDirectionToken, monoFont } from './presentation';
import type { SettlementLegs } from './presentation';

interface TicketSummaryProps {
  ccyPair: string;
  tenor: string;
  direction: Direction;
  quantity: number;
  dealtCurrency: string;
  price: string;
  notional: number;
  settlementDate: string;
  customer: string;
  legs: SettlementLegs | null;
  offMarketPips: number | null;
  isLivePrice: boolean;
  quoteTimerActive: boolean;
  quoteTimeLeft: number;
  quoteDurationSeconds: number;
  quoteExpired: boolean;
  timerHint: string;
  showActions: boolean;
  isSubmitting: boolean;
  canBook: boolean;
  onRefresh: () => void;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          textAlign: 'right',
          fontWeight: strong ? 700 : 500,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 0,
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * The deal ticket's right-hand rail: what is about to be booked, how long the price
 * is good for, and the commit button. It stays sticky beside the form on desktop and
 * falls to the bottom of the flow on a phone, where it doubles as the action bar.
 */
function TicketSummary({
  ccyPair,
  tenor,
  direction,
  quantity,
  dealtCurrency,
  price,
  notional,
  settlementDate,
  customer,
  legs,
  offMarketPips,
  isLivePrice,
  quoteTimerActive,
  quoteTimeLeft,
  quoteDurationSeconds,
  quoteExpired,
  timerHint,
  showActions,
  isSubmitting,
  canBook,
  onRefresh,
}: TicketSummaryProps) {
  const token = getDirectionToken(direction);
  const progress = quoteTimerActive ? Math.max(0, (quoteTimeLeft / quoteDurationSeconds) * 100) : 0;
  const isRunningOut = quoteTimerActive && !quoteExpired && quoteTimeLeft <= 10;
  const timerColour = quoteExpired ? '#B4432F' : isRunningOut ? '#B3801F' : '#12855C';
  const driftPips = offMarketPips == null ? null : Math.abs(offMarketPips);
  const isOffMarket = driftPips != null && driftPips >= 0.5;

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: token.bg, borderBottom: '1px solid', borderColor: token.border }}>
        <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.02em', color: token.fg }}>
            {direction.toUpperCase()} {ccyPair || '—'}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: token.fg, opacity: 0.8 }}>
            {tenor}
          </Typography>
        </Stack>
        <Typography
          sx={{
            mt: 0.4,
            fontFamily: monoFont,
            fontSize: '1.6rem',
            fontWeight: 700,
            lineHeight: 1.1,
            color: token.fg,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Number(price) ? formatRate(price) : '—'}
        </Typography>
        <Typography variant="caption" sx={{ color: token.fg, opacity: 0.85 }}>
          {quantity ? `${formatQuantity(quantity)} ${dealtCurrency}` : 'Enter a quantity'}
          {isLivePrice ? '' : ' · manual price'}
        </Typography>
      </Box>

      <Stack spacing={0.9} sx={{ px: 2, py: 1.5 }}>
        {legs ? (
          <>
            <SummaryRow label="You buy" value={`${formatQuantity(legs.buy.amount)} ${legs.buy.currency}`} strong />
            <SummaryRow label="You sell" value={`${formatQuantity(legs.sell.amount)} ${legs.sell.currency}`} strong />
          </>
        ) : (
          <SummaryRow label="Settlement" value="Complete the ticket" />
        )}
        <SummaryRow label="All-in notional" value={formatCurrency(notional)} />
        <SummaryRow label="Settles" value={settlementDate || '—'} />
        <SummaryRow label="Customer" value={customer || '—'} />
      </Stack>

      {isOffMarket ? (
        <Box sx={{ mx: 2, mb: 1.5, px: 1.25, py: 0.85, borderRadius: 1, bgcolor: '#FBF2E3', border: '1px solid #EBD6AC' }}>
          <Typography variant="caption" sx={{ color: '#8A5A11', fontWeight: 600 }}>
            Ticket is {driftPips!.toFixed(1)} pips {offMarketPips! > 0 ? 'behind' : 'ahead of'} the live market.
          </Typography>
        </Box>
      ) : null}

      {showActions ? (
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              bgcolor: 'divider',
              '& .MuiLinearProgress-bar': { bgcolor: timerColour, borderRadius: 999 },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              flexShrink: 0,
              minWidth: 62,
              textAlign: 'right',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: quoteTimerActive ? timerColour : 'text.secondary',
            }}
          >
            {!quoteTimerActive ? 'Awaiting' : quoteExpired ? '0s left' : `${quoteTimeLeft}s left`}
          </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
          {timerHint}
          </Typography>

          <Stack spacing={1} sx={{ mt: 1.5 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<DoneAllRoundedIcon />}
              disabled={!canBook}
              sx={{ minHeight: 40, fontSize: '0.86rem' }}
            >
              {isSubmitting ? 'Booking trade…' : 'Book trade'}
            </Button>
            <Button
              type="button"
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<ReplayRoundedIcon />}
              onClick={onRefresh}
            >
              Refresh quote
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Paper>
  );
}

export default TicketSummary;
