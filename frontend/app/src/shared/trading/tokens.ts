import type { Direction, LimitOrderStatus } from '@/shared/types';

/**
 * Semantic tokens for the trading screens.
 *
 * The application theme is deliberately monochrome, which leaves order state and
 * trade side looking identical everywhere. These tokens add one restrained layer
 * of meaning — shared by the rate grid and the limit order blotter so a green
 * "Buy" means the same thing on both — without touching the global palette.
 */

export interface StatusToken {
  /** Short desk label; the raw enum is kept for search and CSV export. */
  label: string;
  fg: string;
  bg: string;
  border: string;
  dot: string;
}

export const statusTokens: Record<LimitOrderStatus, StatusToken> = {
  ACTIVE: { label: 'Working', fg: '#1B4F8A', bg: '#EAF1FA', border: '#C2D7EE', dot: '#2563A8' },
  EXECUTED: { label: 'Filled', fg: '#116149', bg: '#E7F4EF', border: '#BADFD0', dot: '#12855C' },
  EXPIRED: { label: 'Expired', fg: '#8A5A11', bg: '#FBF2E3', border: '#EBD6AC', dot: '#B3801F' },
  CANCELLED: { label: 'Cancelled', fg: '#5A6875', bg: '#F1F4F7', border: '#DCE3EA', dot: '#8C9AA8' },
};

export function getStatusToken(status: LimitOrderStatus | string | undefined): StatusToken {
  return statusTokens[status as LimitOrderStatus] || statusTokens.CANCELLED;
}

export interface DirectionToken {
  fg: string;
  bg: string;
  border: string;
  /** Stronger fill used when the side is the primary action on a surface. */
  strong: string;
}

export const directionTokens: Record<Direction, DirectionToken> = {
  Buy: { fg: '#146B50', bg: '#E7F4EF', border: '#BADFD0', strong: '#12855C' },
  Sell: { fg: '#9C3B2E', bg: '#FBEDEA', border: '#EFCCC4', strong: '#B4432F' },
};

export function getDirectionToken(direction: Direction | string | undefined): DirectionToken {
  return directionTokens[direction as Direction] || directionTokens.Buy;
}

/** A price tick that moved up, down, or held. */
export type TickSignal = 'up' | 'down' | null;

export const tickTokens: Record<'up' | 'down', { fg: string; bg: string; arrow: string }> = {
  up: { fg: '#12855C', bg: '#E3F3EC', arrow: '▲' },
  down: { fg: '#B4432F', bg: '#FBEAE6', arrow: '▼' },
};

/** JPY crosses quote to two decimals, so a pip there is 0.01 rather than 0.0001. */
export function pipSize(ccyPair: string | undefined): number {
  return String(ccyPair || '').toUpperCase().includes('JPY') ? 0.01 : 0.0001;
}

export function formatPips(pips: number): string {
  return pips >= 100 ? Math.round(pips).toString() : pips.toFixed(1);
}

/** Full precision quantity: a trading screen needs the real number, not a compact one. */
export function formatQuantity(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
