import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import type { LimitOrder, NormalizedRate, TimeInForce } from '@/shared/types';
import { DirectionTag } from '@/shared/trading/Tags';
import { formatDateTime, formatRate } from '@/shared/utils/formatters';
import {
  formatPips,
  formatQuantity,
  getDirectionToken,
  getTriggerDistance,
  monoFont,
} from './presentation';

export interface AmendOrderForm {
  qty: string;
  limitPrice: string;
  timeInForce: TimeInForce;
  goodTillDate: string;
  comments: string;
}

interface WorkingOrdersPanelProps {
  orders: LimitOrder[];
  quoteLookup: Map<string, NormalizedRate>;
  editingOrderId: string | null;
  amendForm: AmendOrderForm | null;
  processingOrderId: string | null;
  processingOrderAction: '' | 'amend' | 'cancel';
  onStartAmend: (order: LimitOrder) => void;
  onAmendFieldChange: (field: keyof AmendOrderForm, value: string) => void;
  onSaveAmend: (order: LimitOrder) => void;
  onResetAmend: () => void;
  onCancel: (order: LimitOrder) => void;
}

/**
 * Live view of the orders resting behind the grid.
 *
 * Each row compares the working price against the current market so a trader can
 * see which orders are close to triggering without opening the blotter.
 */
function WorkingOrdersPanel({
  orders,
  quoteLookup,
  editingOrderId,
  amendForm,
  processingOrderId,
  processingOrderAction,
  onStartAmend,
  onAmendFieldChange,
  onSaveAmend,
  onResetAmend,
  onCancel,
}: WorkingOrdersPanelProps) {
  const gtdCount = orders.filter((order) => order.timeInForce === 'GTD').length;

  return (
    <Stack spacing={1}>
      <Paper sx={{ px: 1.75, py: 1.4 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <PendingActionsRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Current limit orders
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
          >
            {orders.length} working · {gtdCount} GTD
          </Typography>
        </Stack>
      </Paper>

      {orders.length ? (
        orders.map((order) => {
          const referenceRate = quoteLookup.get(`${order.ccyPair}|${order.tenor}`);
          const liveMarketPrice = referenceRate
            ? order.direction === 'Buy'
              ? referenceRate.ask
              : referenceRate.bid
            : null;
          const distance = getTriggerDistance(
            order.ccyPair,
            order.direction,
            Number(order.limitPrice),
            liveMarketPrice
          );
          const isProcessing = processingOrderId === order.id;
          const isEditing = editingOrderId === order.id && amendForm;

          return (
            <Paper key={order.id} sx={{ p: 1.5 }}>
              <Stack spacing={1.1}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <DirectionTag direction={order.direction} dense />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {order.direction} {order.ccyPair}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.3, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatQuantity(order.qty)} {order.dealtCurrency} · {order.tenor} · {order.timeInForce}
                    </Typography>
                  </Box>

                  {distance ? (
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          lineHeight: 1.2,
                          fontVariantNumeric: 'tabular-nums',
                          color: distance.throughLimit ? '#12855C' : distance.pips <= 10 ? '#B3801F' : 'text.primary',
                        }}
                      >
                        {distance.throughLimit ? 'Trigger hit' : `${formatPips(distance.pips)} pips`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                        {distance.throughLimit ? 'awaiting fill' : 'to trigger'}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 0.75,
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                      Trigger
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRate(order.limitPrice)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                      Live market
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                      {liveMarketPrice == null ? 'N/A' : formatRate(liveMarketPrice)}
                    </Typography>
                  </Box>
                </Box>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.66rem', fontFamily: monoFont, wordBreak: 'break-all' }}
                >
                  {order.id} · {formatDateTime(order.submittedAt)}
                </Typography>

                {isEditing && amendForm ? (
                  <Box
                    sx={{
                      p: 1.1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}>
                        AMEND ORDER
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <TextField
                          size="small"
                          label="Quantity"
                          type="number"
                          value={amendForm.qty}
                          onChange={(event) => onAmendFieldChange('qty', event.target.value)}
                        />
                        <TextField
                          size="small"
                          label="Limit price"
                          type="number"
                          value={amendForm.limitPrice}
                          onChange={(event) => onAmendFieldChange('limitPrice', event.target.value)}
                        />
                        <TextField
                          select
                          size="small"
                          label="TIF"
                          value={amendForm.timeInForce}
                          onChange={(event) => onAmendFieldChange('timeInForce', event.target.value)}
                        >
                          <MenuItem value="GTC">GTC</MenuItem>
                          <MenuItem value="GTD">GTD</MenuItem>
                        </TextField>
                        <TextField
                          size="small"
                          label="Good till"
                          type="date"
                          value={amendForm.goodTillDate}
                          disabled={amendForm.timeInForce !== 'GTD'}
                          onChange={(event) => onAmendFieldChange('goodTillDate', event.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      </Box>
                      <TextField
                        size="small"
                        label="Comments"
                        value={amendForm.comments}
                        onChange={(event) => onAmendFieldChange('comments', event.target.value)}
                        multiline
                        rows={2}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => onSaveAmend(order)}
                          disabled={isProcessing}
                        >
                          {isProcessing && processingOrderAction === 'amend' ? 'Saving…' : 'Save amend'}
                        </Button>
                        <Button size="small" variant="text" color="inherit" onClick={onResetAmend} disabled={isProcessing}>
                          Close
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => onStartAmend(order)}
                    disabled={isProcessing}
                    sx={{ flex: 1 }}
                  >
                    Amend
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onCancel(order)}
                    disabled={isProcessing}
                    sx={{ flex: 1, color: getDirectionToken('Sell').fg }}
                  >
                    {isProcessing && processingOrderAction === 'cancel' ? 'Cancelling…' : 'Cancel order'}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })
      ) : (
        <Paper sx={{ px: 2, py: 3, textAlign: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            No working orders
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
            Rest one from the limit ticket on any spot tile.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

export default WorkingOrdersPanel;
