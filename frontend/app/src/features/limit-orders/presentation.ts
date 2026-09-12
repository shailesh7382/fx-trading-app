import type { LimitOrder } from '@/shared/types';
import { pipSize } from '@/shared/trading/tokens';

/**
 * Limit-order specific presentation helpers. The colour tokens themselves live in
 * `@/shared/trading/tokens` so the rate grid and this blotter stay in step.
 */

export {
  directionTokens,
  formatPips,
  formatQuantity,
  getDirectionToken,
  getStatusToken,
  pipSize,
  statusTokens,
} from '@/shared/trading/tokens';
export type { DirectionToken, StatusToken } from '@/shared/trading/tokens';

/** An order is only amendable or cancellable while it is still resting. */
export function isOrderOpen(order: LimitOrder): boolean {
  return order.status === 'ACTIVE';
}

export interface LimitDistance {
  pips: number;
  /** True once the market has traded at or through the limit. */
  throughLimit: boolean;
}

/**
 * How far the last evaluated market price sits from the trigger, in pips.
 *
 * A buy limit rests below the market and triggers as the market falls; a sell limit
 * is the mirror image. Positive pips therefore always mean "still this far away".
 */
export function getLimitDistance(order: LimitOrder): LimitDistance | null {
  const marketPrice = Number(order.lastEvaluatedPrice || 0);
  const limitPrice = Number(order.limitPrice || 0);

  if (!marketPrice || !limitPrice) {
    return null;
  }

  const rawDistance = order.direction === 'Buy' ? marketPrice - limitPrice : limitPrice - marketPrice;

  return {
    pips: Math.abs(rawDistance) / pipSize(order.ccyPair),
    throughLimit: rawDistance <= 0,
  };
}

export function formatTimeInForce(order: LimitOrder): string {
  if (order.timeInForce !== 'GTD') {
    return 'GTC';
  }

  return order.goodTillDate ? `GTD ${order.goodTillDate}` : 'GTD';
}
