import type { Trade } from '@/shared/types';
import { getCurrencyCodes } from '@/shared/utils/formatters';

export { formatQuantity, getDirectionToken, monoFont } from '@/shared/trading/tokens';

export const productTypeLabels: Record<string, string> = {
  SPOT_FWD: 'FX Spot/Fwd',
  SWAP: 'FX Swap',
  NDF: 'NDF',
  BULLION: 'Bullion',
};

export function getProductLabel(trade: Trade): string {
  return productTypeLabels[trade.productType || ''] || trade.productType || 'FX Spot/Fwd';
}

export interface TradeNotional {
  amount: number;
  currency: string;
}

/**
 * Consideration for a ticket, in the currency actually being exchanged.
 *
 * Booked trades carry both settlement legs, so the contra leg is the truth; when
 * they don't, it falls back to quantity times rate. Either way the currency travels
 * with the number — a JPY ticket is not "$1.8bn".
 */
export function getTradeNotional(trade: Trade): TradeNotional {
  const { base, terms } = getCurrencyCodes(trade.ccyPair);
  const dealt = trade.dealtCurrency || base;
  const contra = dealt === base ? terms : base;

  if (trade.buyCurrency === contra && trade.buyQuantity) {
    return { amount: Number(trade.buyQuantity), currency: contra };
  }

  if (trade.sellCurrency === contra && trade.sellQuantity) {
    return { amount: Number(trade.sellQuantity), currency: contra };
  }

  const quantity = Number(trade.qty || 0);
  const price = Number(trade.price || 0);

  return {
    amount: dealt === base ? quantity * price : quantity / (price || 1),
    currency: contra,
  };
}

export function getExecutionLabel(trade: Trade): string {
  return trade.executionType === 'LIMIT' ? 'Limit fill' : 'Market';
}

export function getCaptureLabel(trade: Trade): string {
  return trade.bookingMode === 'local' ? 'Local fallback' : 'Live capture';
}
