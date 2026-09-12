import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { LimitOrder } from '@/shared/types';
import { formatRate } from '@/shared/utils/formatters';
import { DirectionTag } from './OrderTags';
import { formatQuantity, formatTimeInForce } from './presentation';

interface CancelOrderDialogProps {
  order: LimitOrder | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Cancelling a resting order is irreversible, so it gets an explicit confirmation. */
function CancelOrderDialog({ order, isBusy, onClose, onConfirm }: CancelOrderDialogProps) {
  return (
    <Dialog
      open={Boolean(order)}
      onClose={isBusy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 1.5 } } }}
    >
      <DialogTitle sx={{ fontSize: '1.05rem' }}>Cancel this order?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          The order stops resting in the market immediately. This cannot be undone.
        </DialogContentText>
        {order ? (
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <DirectionTag direction={order.direction} />
              <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                {order.ccyPair}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatQuantity(order.qty)} {order.dealtCurrency} @ {formatRate(order.limitPrice)} ·{' '}
              {formatTimeInForce(order)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {order.id}
            </Typography>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isBusy} color="inherit">
          Keep order
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={isBusy}>
          {isBusy ? 'Cancelling…' : 'Cancel order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CancelOrderDialog;
