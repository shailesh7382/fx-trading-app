import { Box, ButtonBase, IconButton, InputBase, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import type { Direction, FxRate } from '@/shared/types';
import { formatRelativeTime, getCurrencyCodes, getRateDisplayParts } from '@/shared/utils/formatters';
import LimitTicket from './LimitTicket';
import type { LimitOrderForm } from './LimitTicket';
import {
  formatPips,
  formatQuantity,
  getContraAmount,
  getDirectionToken,
  getPriceTileStyles,
  getSpreadPips,
  monoFont,
  tickTokens,
} from './presentation';
import type { TickSignal } from './presentation';

export interface TileFlash {
  bid: TickSignal;
  ask: TickSignal;
}

interface PriceProps {
  side: Direction;
  label: string;
  price: number;
  points?: number | null;
  signal: TickSignal;
  onTrade: () => void;
}

/**
 * One side of the two-way price.
 *
 * The whole tile is the click target — on a trading screen the price is the button —
 * and the big pip digits keep the same three-part treatment used across the desk.
 */
function PriceSide({ side, label, price, points, signal, onTrade }: PriceProps) {
  const token = getDirectionToken(side);
  const { major, significant, pipette } = getRateDisplayParts(price);
  const flash = signal ? tickTokens[signal] : null;

  return (
    <ButtonBase aria-label={side} onClick={onTrade} sx={getPriceTileStyles(token.bg, signal)}>
      <Stack sx={{ width: '100%', minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
          <Typography
            component="span"
            sx={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.1em', color: token.fg }}
          >
            {label}
          </Typography>
          {flash ? (
            <Typography component="span" sx={{ fontSize: '0.62rem', lineHeight: 1, color: flash.fg }}>
              {flash.arrow}
            </Typography>
          ) : null}
        </Stack>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            lineHeight: 1,
            mt: 0.25,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: monoFont,
            color: token.fg,
          }}
        >
          <Typography component="span" sx={{ fontSize: { xs: '0.8rem', md: '0.88rem' }, fontWeight: 600, mt: 0.42, opacity: 0.75 }}>
            {major}
          </Typography>
          <Typography component="span" sx={{ fontSize: { xs: '1.75rem', md: '2rem' }, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {significant}
          </Typography>
          {pipette ? (
            <Typography component="span" sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' }, fontWeight: 800, mt: 0.32, opacity: 0.85 }}>
              {pipette}
            </Typography>
          ) : null}
        </Box>

        {points != null ? (
          <Typography component="span" sx={{ fontSize: '0.66rem', color: 'text.secondary', mt: 0.15 }}>
            Fwd pts {points}
          </Typography>
        ) : null}
      </Stack>
    </ButtonBase>
  );
}

interface RateTileProps {
  rate: FxRate;
  ccyPair: string;
  tenor: string;
  pairOptions: string[];
  tenorOptions: string[];
  flash: TileFlash | undefined;
  dealQuantity: string;
  isEditingQuantity: boolean;
  dealtCurrency: string;
  valueDate: string;
  limitForm: LimitOrderForm;
  isSubmittingLimit: boolean;
  onPairChange: (ccyPair: string) => void;
  onTenorChange: (tenor: string) => void;
  onQuantityChange: (value: string) => void;
  onQuantityFocus: () => void;
  onQuantityBlur: () => void;
  onToggleDealCurrency: () => void;
  onTrade: (direction: Direction) => void;
  onLimitFieldChange: (field: keyof LimitOrderForm, value: string) => void;
  onSubmitLimit: () => void;
}

function RateTile({
  rate,
  ccyPair,
  tenor,
  pairOptions,
  tenorOptions,
  flash,
  dealQuantity,
  isEditingQuantity,
  dealtCurrency,
  valueDate,
  limitForm,
  isSubmittingLimit,
  onPairChange,
  onTenorChange,
  onQuantityChange,
  onQuantityFocus,
  onQuantityBlur,
  onToggleDealCurrency,
  onTrade,
  onLimitFieldChange,
  onSubmitLimit,
}: RateTileProps) {
  const { base, terms } = getCurrencyCodes(ccyPair);
  const isSpot = tenor === 'SP';
  const spreadPips = getSpreadPips(rate);
  const nextDealCurrency = dealtCurrency === base ? terms : base;
  const quantity = Number.parseInt(dealQuantity, 10) || 0;
  const contraCurrency = dealtCurrency === base ? terms : base;
  const midPrice = (Number(rate.bid || 0) + Number(rate.ask || 0)) / 2;
  const contraAmount = getContraAmount(quantity, midPrice, dealtCurrency, base);

  return (
    <Paper sx={{ borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: { xs: 1, md: 1.25 },
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <TextField
          select
          size="small"
          variant="standard"
          fullWidth={false}
          value={ccyPair}
          onChange={(event) => onPairChange(event.target.value)}
          slotProps={{ select: { disableUnderline: true }, htmlInput: { 'aria-label': `${ccyPair} instrument` } }}
          sx={{
            minWidth: 0,
            '& .MuiSelect-select': {
              py: 0.1,
              pr: 2.5,
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.01em',
            },
          }}
        >
          {pairOptions.map((pairOption) => (
            <MenuItem key={pairOption} value={pairOption} sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {pairOption}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {spreadPips != null ? (
            <Tooltip title="Bid/ask spread in pips">
              <Box
                component="span"
                sx={{
                  px: 0.7,
                  py: 0.15,
                  borderRadius: 0.75,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatPips(spreadPips)} sp
              </Box>
            </Tooltip>
          ) : null}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#12855C', flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem', whiteSpace: 'nowrap' }}>
              {formatRelativeTime(rate.updatedAt)}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      <ToggleButtonGroup
          exclusive
          size="small"
          value={tenor}
          onChange={(_event, value: string | null) => value && onTenorChange(value)}
          aria-label={`${ccyPair} tenor`}
          sx={{
            px: { xs: 1, md: 1.25 },
            pt: 1,
            gap: 0.5,
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              px: 0.9,
              py: 0.2,
              minHeight: 24,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '999px !important',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: 'text.secondary',
            },
            '& .MuiToggleButton-root.Mui-selected': {
              bgcolor: 'primary.main',
              borderColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
        {tenorOptions.map((tenorOption) => (
          <ToggleButton key={tenorOption} value={tenorOption} disabled={tenorOptions.length === 1}>
            {tenorOption}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack spacing={1} sx={{ p: { xs: 1, md: 1.25 }, flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 0.75,
          }}
        >
          <PriceSide
            side="Sell"
            label="SELL"
            price={rate.bid}
            points={isSpot ? null : (rate.bidPoints ?? 0)}
            signal={flash?.bid ?? null}
            onTrade={() => onTrade('Sell')}
          />
          <PriceSide
            side="Buy"
            label="BUY"
            price={rate.ask}
            points={isSpot ? null : (rate.askPoints ?? 0)}
            signal={flash?.ask ?? null}
            onTrade={() => onTrade('Buy')}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.6,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}
            >
              AMT
            </Typography>
            <InputBase
              value={isEditingQuantity ? dealQuantity : formatQuantity(dealQuantity)}
              onChange={(event) => onQuantityChange(event.target.value)}
              onFocus={(event) => {
                onQuantityFocus();
                event.target.select();
              }}
              onBlur={onQuantityBlur}
              inputProps={{
                'aria-label': `${ccyPair} quantity`,
                inputMode: 'numeric',
                pattern: '[0-9,]*',
              }}
              sx={{
                flex: '0 1 auto',
                minWidth: 64,
                maxWidth: 128,
                fontWeight: 700,
                fontSize: '0.8rem',
                fontVariantNumeric: 'tabular-nums',
                '& input': { p: 0, textAlign: 'right' },
              }}
            />
            <Typography sx={{ fontWeight: 700, fontSize: '0.74rem', letterSpacing: '0.02em' }}>
              {dealtCurrency}
            </Typography>
            <Tooltip title={nextDealCurrency ? `Deal in ${nextDealCurrency} instead` : 'Only one currency available'}>
              <span>
                <IconButton
                  size="small"
                  onClick={onToggleDealCurrency}
                  disabled={!nextDealCurrency}
                  aria-label={
                    nextDealCurrency
                      ? `Toggle dealt currency to ${nextDealCurrency}`
                      : 'Only one currency available'
                  }
                  sx={{ color: 'text.secondary', p: 0.3 }}
                >
                  <SwapHorizRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Stack sx={{ alignItems: 'flex-end', minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.66rem', color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
            >
              {contraAmount ? `≈ ${formatQuantity(contraAmount)} ${contraCurrency}` : '—'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.66rem', color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              Settles {valueDate}
            </Typography>
          </Stack>
        </Box>

        <LimitTicket
          ccyPair={ccyPair}
          isSpot={isSpot}
          rate={rate}
          form={limitForm}
          isSubmitting={isSubmittingLimit}
          onFieldChange={onLimitFieldChange}
          onSubmit={onSubmitLimit}
        />
      </Stack>
    </Paper>
  );
}

export default RateTile;
