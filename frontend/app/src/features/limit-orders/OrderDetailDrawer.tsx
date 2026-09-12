import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import type { LimitOrder } from '@/shared/types';
import { formatDateTime, formatRate } from '@/shared/utils/formatters';
import { DirectionTag, FieldRow, StatusTag } from './OrderTags';
import { formatPips, formatQuantity, formatTimeInForce, getLimitDistance, isOrderOpen } from './presentation';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, monospace';

interface OrderDetailDrawerProps {
  order: LimitOrder | null;
  isBusy: boolean;
  onClose: () => void;
  onAmend: (order: LimitOrder) => void;
  onCancel: (order: LimitOrder) => void;
}

/**
 * Full record for a single order. On desktop it slides in from the right so the
 * blotter stays visible behind it; on a phone it becomes a bottom sheet, which is
 * where a thumb already is.
 */
function OrderDetailDrawer({ order, isBusy, onClose, onAmend, onCancel }: OrderDetailDrawerProps) {
  const distance = order ? getLimitDistance(order) : null;

  return (
    <Drawer
      anchor="right"
      open={Boolean(order)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: '100%',
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      {order ? (
        <Stack sx={{ height: '100%' }}>
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                  <DirectionTag direction={order.direction} />
                  <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                    {order.ccyPair}
                  </Typography>
                  <StatusTag status={order.status} />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
                  {order.id}
                </Typography>
              </Box>
              <IconButton onClick={onClose} size="small" aria-label="Close order details">
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Order
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FieldRow label="Quantity" value={`${formatQuantity(order.qty)} ${order.dealtCurrency || ''}`} />
              <FieldRow label="Limit price" value={formatRate(order.limitPrice)} />
              <FieldRow
                label="Fill price"
                value={order.executedPrice ? formatRate(order.executedPrice) : 'Not filled'}
              />
              {isOrderOpen(order) ? (
                <FieldRow
                  label="Distance"
                  value={
                    distance
                      ? distance.throughLimit
                        ? 'At or through limit'
                        : `${formatPips(distance.pips)} pips away`
                      : 'Not evaluated yet'
                  }
                />
              ) : null}
              <FieldRow label="Time in force" value={formatTimeInForce(order)} />
              <FieldRow label="Tenor" value={order.contractTenor || order.tenor || 'SP'} />
              <FieldRow label="Trader" value={order.trader || 'system'} />
              {order.comments ? <FieldRow label="Comments" value={order.comments} /> : null}
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Lifecycle
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FieldRow label="Submitted" value={formatDateTime(order.submittedAt)} />
              {order.executedAt ? <FieldRow label="Executed" value={formatDateTime(order.executedAt)} /> : null}
              {order.expiresAt ? <FieldRow label="Expires" value={formatDateTime(order.expiresAt)} /> : null}
              {order.closedAt ? <FieldRow label="Closed" value={formatDateTime(order.closedAt)} /> : null}
              <FieldRow
                label="Last checked"
                value={
                  order.lastEvaluatedAt
                    ? `${formatDateTime(order.lastEvaluatedAt)} @ ${formatRate(order.lastEvaluatedPrice || 0)}`
                    : 'Never'
                }
              />
              <FieldRow label="Trade date" value={order.tradeDate || 'N/A'} />
              <FieldRow label="Settlement" value={order.settlementDate || 'N/A'} />
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Routing
            </Typography>
            <Box sx={{ pb: 1 }}>
              <FieldRow label="Channel" value={order.channel || 'N/A'} />
              <FieldRow label="Segment" value={order.segment || 'N/A'} />
              <FieldRow label="Customer" value={order.customerId || 'N/A'} />
              <FieldRow
                label="Callback"
                value={`${order.callbackStatus || 'NOT_REQUIRED'} · ${order.callbackAttempts || 0} ${
                  order.callbackAttempts === 1 ? 'attempt' : 'attempts'
                }`}
              />
              {order.simulatorTradeId ? (
                <FieldRow
                  label="Simulator trade"
                  value={<Box component="span" sx={{ fontFamily: monoFont }}>{order.simulatorTradeId}</Box>}
                />
              ) : null}
              {order.requestId ? (
                <FieldRow
                  label="Request ID"
                  value={<Box component="span" sx={{ fontFamily: monoFont }}>{order.requestId}</Box>}
                />
              ) : null}
            </Box>
          </Box>

          {isOrderOpen(order) ? (
            <>
              <Divider />
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ px: 2.5, py: 2, bgcolor: 'background.default' }}
              >
                <Button
                  fullWidth
                  variant="outlined"
                  color="inherit"
                  startIcon={<BlockRoundedIcon />}
                  disabled={isBusy}
                  onClick={() => onCancel(order)}
                >
                  Cancel order
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<EditRoundedIcon />}
                  disabled={isBusy}
                  onClick={() => onAmend(order)}
                >
                  Amend
                </Button>
              </Stack>
            </>
          ) : null}
        </Stack>
      ) : null}
    </Drawer>
  );
}

export default OrderDetailDrawer;
