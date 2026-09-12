import type { Direction } from '@/shared/types';
import { getCurrencyCodes } from '@/shared/utils/formatters';
import { pipSize } from '@/shared/trading/tokens';

export { formatQuantity, getDirectionToken, monoFont, pipSize } from '@/shared/trading/tokens';

export interface SettlementLeg {
  currency: string;
  amount: number;
}

export interface SettlementLegs {
  buy: SettlementLeg;
  sell: SettlementLeg;
}

/**
 * The two cash legs implied by a ticket.
 *
 * The dealt currency is the side the quantity refers to; the contra amount follows
 * from the price, inverted when the client is dealing in the terms currency.
 */
export function getSettlementLegs(
  ccyPair: string,
  direction: Direction,
  dealtCurrency: string,
  quantity: number,
  price: number
): SettlementLegs | null {
  const { base, terms } = getCurrencyCodes(ccyPair);

  if (!base || !terms || !quantity || !price) {
    return null;
  }

  const dealt = dealtCurrency || base;
  const contra = dealt === base ? terms : base;
  const contraAmount = dealt === base ? quantity * price : quantity / price;

  const dealtLeg = { currency: dealt, amount: quantity };
  const contraLeg = { currency: contra, amount: contraAmount };

  return direction === 'Buy' ? { buy: dealtLeg, sell: contraLeg } : { buy: contraLeg, sell: dealtLeg };
}

/**
 * How far the ticket price has drifted from the live market, in pips.
 *
 * Positive means the ticket is worse for the client than the current screen price,
 * which is the direction worth warning about.
 */
export function getOffMarketPips(
  ccyPair: string,
  direction: Direction,
  ticketPrice: number,
  marketPrice: number | null
): number | null {
  if (!ticketPrice || !marketPrice) {
    return null;
  }

  const drift = direction === 'Buy' ? ticketPrice - marketPrice : marketPrice - ticketPrice;

  return drift / pipSize(ccyPair);
}
