import type { SxProps, Theme } from '@mui/material';
import type { FxRate } from '@/shared/types';
import { pipSize, tickTokens } from '@/shared/trading/tokens';
import type { TickSignal } from '@/shared/trading/tokens';

/** Presentation helpers for the rate grid. Colour tokens live in `@/shared/trading/tokens`. */

export {
  formatPips,
  formatQuantity,
  getDirectionToken,
  monoFont,
  pipSize,
  tickTokens,
} from '@/shared/trading/tokens';
export type { TickSignal } from '@/shared/trading/tokens';

export const tenorOrder = ['SP', '1W', '1M', '3M', '6M', '1Y'];

export function getTenorSortOrder(tenor: string): number {
  const index = tenorOrder.indexOf(tenor);
  return index === -1 ? tenorOrder.length : index;
}

export function getTickSignal(currentValue: number, previousValue: number | undefined): TickSignal {
  if (previousValue == null || currentValue === previousValue) {
    return null;
  }

  return currentValue > previousValue ? 'up' : 'down';
}

/** Bid/ask spread of a quote, expressed in pips for the instrument. */
export function getSpreadPips(rate: FxRate | undefined): number | null {
  if (!rate || !rate.bid || !rate.ask) {
    return null;
  }

  return Math.max(0, (Number(rate.ask) - Number(rate.bid)) / pipSize(rate.ccyPair));
}

/**
 * Background and colour for a price tile, blended with a brief tick flash.
 *
 * `sideTint` carries the permanent identity of the side (buy or sell); the flash is
 * a short-lived overlay that says which way the price just moved.
 */
export function getPriceTileStyles(sideTint: string, signal: TickSignal | undefined): SxProps<Theme> {
  const flash = signal ? tickTokens[signal] : null;

  return {
    position: 'relative',
    display: 'block',
    width: '100%',
    textAlign: 'left',
    px: { xs: 1, md: 1.25 },
    py: { xs: 0.85, md: 1 },
    borderRadius: 1,
    border: '1px solid',
    borderColor: flash ? flash.fg : 'divider',
    bgcolor: flash ? flash.bg : sideTint,
    transition: 'background-color 220ms ease, border-color 220ms ease',
    '&:hover': { borderColor: flash ? flash.fg : 'text.disabled' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
  };
}

/**
 * Distance from the live market to a resting limit, in pips.
 *
 * Positive means the market still has that far to travel before the order triggers.
 */
export function getTriggerDistance(
  ccyPair: string,
  direction: string,
  limitPrice: number,
  marketPrice: number | null
): { pips: number; throughLimit: boolean } | null {
  if (!marketPrice || !limitPrice) {
    return null;
  }

  const rawDistance = direction === 'Buy' ? marketPrice - limitPrice : limitPrice - marketPrice;

  return {
    pips: Math.abs(rawDistance) / pipSize(ccyPair),
    throughLimit: rawDistance <= 0,
  };
}

/** Contra amount implied by a quantity and price, for the "you receive" hint. */
export function getContraAmount(
  quantity: number,
  price: number,
  dealtCurrency: string,
  baseCurrency: string
): number {
  if (!quantity || !price) {
    return 0;
  }

  return dealtCurrency === baseCurrency ? quantity * price : quantity / price;
}
