import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import type { Direction, FxRate, TimeInForce } from '@/shared/types';
import { formatRate } from '@/shared/utils/formatters';
import { formatPips, getDirectionToken, getTriggerDistance, pipSize } from './presentation';

export interface LimitOrderForm {
  ccyPair: string;
  tenor: string;
  direction: Direction;
  limitPrice: string;
  timeInForce: TimeInForce;
  goodTillDate: string;
}

interface LimitTicketProps {
  ccyPair: string;
  isSpot: boolean;
  rate: FxRate;
  form: LimitOrderForm;
  isSubmitting: boolean;
  onFieldChange: (field: keyof LimitOrderForm, value: string) => void;
  onSubmit: () => void;
}

const compactFieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 0.75, bgcolor: 'background.paper', minHeight: 32 },
  '& .MuiSelect-select': { py: 0.55, fontSize: '0.76rem', fontWeight: 700 },
  '& .MuiInputBase-input': { py: 0.55, fontSize: '0.78rem', fontWeight: 700 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
};

/**
 * The resting-order ticket that sits under each spot rate tile.
 *
 * It always shows where the working price sits relative to the live market, so the
 * trader can see at a glance whether the order would rest or fill on arrival.
 */
function LimitTicket({ ccyPair, isSpot, rate, form, isSubmitting, onFieldChange, onSubmit }: LimitTicketProps) {
  if (!isSpot) {
    return (
      <Box
        sx={{
          px: 1.25,
          py: 1,
          borderRadius: 1,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Limit orders are available on spot only. Switch the tenor to SP to rest an order.
        </Typography>
      </Box>
    );
  }

  const marketPrice = form.direction === 'Buy' ? Number(rate.ask || 0) : Number(rate.bid || 0);
  const limitPrice = Number(form.limitPrice || 0);
  const distance = getTriggerDistance(ccyPair, form.direction, limitPrice, marketPrice);
  const sideToken = getDirectionToken(form.direction);

  const nudgePrice = (steps: number) => {
    const step = pipSize(ccyPair);
    const next = Math.max(0, (limitPrice || marketPrice) + steps * step);
    onFieldChange('limitPrice', formatRate(next));
  };

  return (
    <Box
      sx={{
        px: { xs: 1, md: 1.25 },
        py: { xs: 1, md: 1.1 },
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary' }}
          >
            LIMIT ORDER
          </Typography>
          {distance ? (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: distance.throughLimit && distance.pips >= 0.05 ? sideToken.strong : 'text.secondary',
              }}
            >
              {distance.pips < 0.05
                ? 'At market'
                : distance.throughLimit
                  ? 'Fills immediately'
                  : `${formatPips(distance.pips)} pips from market`}
            </Typography>
          ) : null}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 0.75,
            gridTemplateColumns: 'minmax(74px, 0.5fr) minmax(0, 1fr) auto',
            alignItems: 'center',
          }}
        >
          <TextField
            select
            size="small"
            value={form.direction}
            onChange={(event) => onFieldChange('direction', event.target.value)}
            slotProps={{
              select: { displayEmpty: true },
              htmlInput: { 'aria-label': `${ccyPair} limit order side` },
            }}
            sx={{
              ...compactFieldSx,
              '& .MuiSelect-select': { ...compactFieldSx['& .MuiSelect-select'], color: sideToken.fg },
            }}
          >
            <MenuItem value="Buy">Buy</MenuItem>
            <MenuItem value="Sell">Sell</MenuItem>
          </TextField>

          <TextField
            size="small"
            type="number"
            value={form.limitPrice}
            onChange={(event) => onFieldChange('limitPrice', event.target.value)}
            placeholder="Limit price"
            slotProps={{ htmlInput: { 'aria-label': `${ccyPair} limit price`, step: 'any' } }}
            sx={{
              ...compactFieldSx,
              '& input[type=number]': { MozAppearance: 'textfield' },
              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0,
              },
            }}
          />

          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Down one pip">
              <IconButton
                size="small"
                aria-label={`Lower ${ccyPair} limit price by one pip`}
                onClick={() => nudgePrice(-1)}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0.75, p: 0.35 }}
              >
                <RemoveRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Up one pip">
              <IconButton
                size="small"
                aria-label={`Raise ${ccyPair} limit price by one pip`}
                onClick={() => nudgePrice(1)}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0.75, p: 0.35 }}
              >
                <AddRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <TextField
            select
            size="small"
            value={form.timeInForce}
            onChange={(event) => onFieldChange('timeInForce', event.target.value)}
            slotProps={{
              select: { displayEmpty: true },
              htmlInput: { 'aria-label': `${ccyPair} limit order tif` },
            }}
            sx={{ ...compactFieldSx, width: 78, flexShrink: 0 }}
          >
            <MenuItem value="GTC">GTC</MenuItem>
            <MenuItem value="GTD">GTD</MenuItem>
          </TextField>

          {form.timeInForce === 'GTD' ? (
            <TextField
              size="small"
              type="date"
              value={form.goodTillDate}
              onChange={(event) => onFieldChange('goodTillDate', event.target.value)}
              slotProps={{ htmlInput: { 'aria-label': `${ccyPair} good till date` } }}
              sx={{ ...compactFieldSx, flex: '1 1 auto', minWidth: 0 }}
            />
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.7rem' }}
            >
              Until cancelled
            </Typography>
          )}

          <Button
            variant="contained"
            size="small"
            onClick={onSubmit}
            disabled={isSubmitting}
            sx={{ minHeight: 32, fontSize: '0.72rem', px: 1.25, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {isSubmitting ? 'Submitting…' : 'Submit limit order'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default LimitTicket;
