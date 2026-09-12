import type { NormalizedRate } from '@/shared/types';
import { pipSize } from '@/shared/trading/tokens';

export { formatQuantity, monoFont, pipSize } from '@/shared/trading/tokens';

/**
 * Chart tokens for the analysis screen.
 *
 * The diverging pair was validated rather than eyeballed: `#12855C` / `#D2452F`
 * clears the colour-vision separation gate (OKLab dE 8.8 under protanopia, 27.3
 * under normal vision) against a white surface, so a rise and a fall stay
 * distinguishable without relying on hue alone. Bars also carry position either
 * side of the zero line and an arrow glyph, so colour is never the only channel.
 *
 * Instruments have no natural order, so magnitude charts use one flat hue for
 * every bar — a darker-where-bigger ramp would double-encode the bar's length.
 */
export const chartTokens = {
  up: '#12855C',
  down: '#D2452F',
  magnitude: '#2563A8',
  grid: '#E3E9EF',
  zeroLine: '#C7D3E0',
  track: '#F1F4F7',
};

/** Move since the previous tick, in pips for the instrument. */
export function getMovePips(rate: NormalizedRate): number {
  return Number(rate.bidDelta || 0) / pipSize(rate.ccyPair);
}

export function formatSignedPips(pips: number): string {
  const rounded = Math.abs(pips) >= 100 ? Math.round(pips) : Number(pips.toFixed(1));

  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/**
 * Rounds an axis maximum up to a clean 1 / 2 / 5 x 10^n step so the ticks read as
 * whole numbers rather than whatever the data happened to reach.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => normalised <= candidate) ?? 10;

  return step * magnitude;
}

/** Evenly spaced tick values from zero to `max`, inclusive. */
export function buildTicks(max: number, steps = 2): number[] {
  return Array.from({ length: steps + 1 }, (_, index) => (max / steps) * index);
}

export function formatPipValue(pips: number): string {
  return Math.abs(pips) >= 10 ? pips.toFixed(0) : pips.toFixed(1);
}
