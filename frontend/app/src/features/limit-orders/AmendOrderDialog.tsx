import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { LimitOrder, LimitOrderAmendment, TimeInForce } from '@/shared/types';
import { DirectionTag } from './OrderTags';

interface AmendFormState {
  qty: string;
  limitPrice: string;
  timeInForce: TimeInForce;
  goodTillDate: string;
  comments: string;
}

function buildFormState(order: LimitOrder | null): AmendFormState {
  return {
    qty: order ? String(order.qty ?? '') : '',
    limitPrice: order ? String(order.limitPrice ?? '') : '',
    timeInForce: order?.timeInForce || 'GTC',
    goodTillDate: order?.goodTillDate || '',
    comments: order?.comments || '',
  };
}

interface AmendOrderDialogProps {
  order: LimitOrder | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (orderId: string, amendment: LimitOrderAmendment) => Promise<void>;
}

/**
 * Amend ticket for a resting order. Only the fields the desk is allowed to change
 * are editable; instrument, direction and dealt currency are shown read-only so the
 * trader can confirm they are amending the order they meant to.
 */
function AmendOrderDialog({ order, isSaving, onClose, onSubmit }: AmendOrderDialogProps) {
  const [form, setForm] = useState<AmendFormState>(() => buildFormState(order));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(buildFormState(order));
    setValidationError('');
  }, [order]);

  const updateField = (field: keyof AmendFormState, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }) as AmendFormState);
  };

  const handleSubmit = async () => {
    if (!order) {
      return;
    }

    const parsedQty = Number.parseInt(form.qty, 10);
    const parsedLimitPrice = Number(form.limitPrice);

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setValidationError('Enter a quantity greater than zero.');
      return;
    }

    if (!Number.isFinite(parsedLimitPrice) || parsedLimitPrice <= 0) {
      setValidationError('Enter a limit price greater than zero.');
      return;
    }

    if (form.timeInForce === 'GTD' && !form.goodTillDate) {
      setValidationError('A good-till-date order needs an expiry date.');
      return;
    }

    setValidationError('');

    await onSubmit(order.id, {
      qty: parsedQty,
      limitPrice: parsedLimitPrice,
      timeInForce: form.timeInForce,
      goodTillDate: form.timeInForce === 'GTD' ? form.goodTillDate : null,
      comments: form.comments,
    });
  };

  return (
    <Dialog
      open={Boolean(order)}
      onClose={isSaving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 1.5 } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontSize: '1.05rem' }}>
          Amend order
        </Typography>
        {order ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.75 }}>
            <DirectionTag direction={order.direction} />
            <Typography variant="body2" sx={{ fontWeight: 650 }}>
              {order.ccyPair}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {order.id}
            </Typography>
          </Stack>
        ) : null}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {validationError ? <Alert severity="error">{validationError}</Alert> : null}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              label="Quantity"
              size="small"
              value={form.qty}
              onChange={(event) => updateField('qty', event.target.value)}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              helperText={order?.dealtCurrency ? `Dealt in ${order.dealtCurrency}` : ' '}
            />
            <TextField
              label="Limit price"
              size="small"
              value={form.limitPrice}
              onChange={(event) => updateField('limitPrice', event.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              helperText=" "
            />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              select
              label="Time in force"
              size="small"
              value={form.timeInForce}
              onChange={(event) => updateField('timeInForce', event.target.value)}
            >
              <MenuItem value="GTC">GTC</MenuItem>
              <MenuItem value="GTD">GTD</MenuItem>
            </TextField>
            <TextField
              label="Good till date"
              type="date"
              size="small"
              value={form.goodTillDate}
              disabled={form.timeInForce !== 'GTD'}
              onChange={(event) => updateField('goodTillDate', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <TextField
            label="Comments"
            size="small"
            multiline
            minRows={2}
            value={form.comments}
            onChange={(event) => updateField('comments', event.target.value)}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSaving} color="inherit">
          Discard
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save amendment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AmendOrderDialog;
