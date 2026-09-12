import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { Direction, LimitOrderStatus } from '@/shared/types';
import { getDirectionToken, getStatusToken } from './presentation';

/** Status pill with a leading state dot, sized to sit inside a dense table row. */
export function StatusTag({ status, dense = false }: { status: LimitOrderStatus; dense?: boolean }) {
  const token = getStatusToken(status);

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.65,
        px: dense ? 0.75 : 1,
        height: dense ? 20 : 24,
        borderRadius: 999,
        bgcolor: token.bg,
        border: '1px solid',
        borderColor: token.border,
        color: token.fg,
        fontSize: dense ? '0.68rem' : '0.72rem',
        fontWeight: 650,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: token.dot, flexShrink: 0 }} />
      {token.label}
    </Box>
  );
}

/** Buy/Sell marker. Colour carries the meaning at a glance; the word carries it for everyone else. */
export function DirectionTag({ direction }: { direction: Direction }) {
  const token = getDirectionToken(direction);

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.75,
        height: 20,
        minWidth: 42,
        borderRadius: 0.75,
        bgcolor: token.bg,
        border: '1px solid',
        borderColor: token.border,
        color: token.fg,
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {direction}
    </Box>
  );
}

/** Label/value pair used by the detail drawer. */
export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
        gap: 1.5,
        alignItems: 'baseline',
        py: 0.85,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}
