import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import type { Trade } from '@/shared/types';
import { monoFont } from './presentation';

interface TradeConfirmationProps {
  trade: Trade;
  rows: Array<[string, string | undefined]>;
  onBookAnother: () => void;
  onViewBlotter: () => void;
}

/** The reverse face of the ticket: what was booked, and where to go next. */
function TradeConfirmation({ trade, rows, onBookAnother, onViewBlotter }: TradeConfirmationProps) {
  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, bgcolor: '#E7F4EF', borderBottom: '1px solid #BADFD0' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CheckCircleRoundedIcon sx={{ color: '#12855C', fontSize: 30 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', color: '#0F5540' }}>
              Trade confirmation
            </Typography>
            <Typography variant="body2" sx={{ color: '#146B50' }}>
              Trade {trade.id} booked.
            </Typography>
          </Box>
          <Chip
            size="small"
            color={trade.bookingMode === 'live' ? 'primary' : 'warning'}
            label={trade.bookingMode === 'live' ? 'Live capture' : 'Local fallback'}
          />
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            columnGap: { sm: 4 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {rows.map(([label, value]) => (
            <Stack
              key={label}
              direction="row"
              spacing={1.5}
              sx={{
                justifyContent: 'space-between',
                alignItems: 'baseline',
                py: 0.7,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
                {label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: label === 'Trade ID' ? monoFont : undefined,
                  wordBreak: 'break-word',
                }}
              >
                {value}
              </Typography>
            </Stack>
          ))}
        </Box>

        {trade.productDetails ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {trade.productDetails}
          </Typography>
        ) : null}
        {trade.comments ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {trade.comments}
          </Typography>
        ) : null}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          px: { xs: 2, md: 2.5 },
          py: 1.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          justifyContent: 'space-between',
        }}
      >
        <Button
          type="button"
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<AddCircleOutlineRoundedIcon />}
          onClick={onBookAnother}
        >
          Book another
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          startIcon={<ReceiptLongRoundedIcon />}
          onClick={onViewBlotter}
          sx={{ minWidth: { sm: 168 } }}
        >
          View in blotter
        </Button>
      </Stack>
    </Stack>
  );
}

export default TradeConfirmation;
