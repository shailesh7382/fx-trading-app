import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { Trade } from '@/shared/types';
import { DirectionTag, FieldRow, MetaTag } from '@/shared/trading/Tags';
import { formatDateTime, formatRate } from '@/shared/utils/formatters';
import {
  formatQuantity,
  getCaptureLabel,
  getExecutionLabel,
  getProductLabel,
  getTradeNotional,
  monoFont,
} from './presentation';

interface TradeDetailDrawerProps {
  trade: Trade | null;
  onClose: () => void;
}

/**
 * Full record for one ticket. Internal pricing — quote identifiers, cover prices —
 * stays out: this is the client-facing view of the trade.
 */
function TradeDetailDrawer({ trade, onClose }: TradeDetailDrawerProps) {
  const notional = trade ? getTradeNotional(trade) : null;

  return (
    <Drawer
      anchor="right"
      open={Boolean(trade)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100%', borderLeft: '1px solid', borderColor: 'divider' },
        },
      }}
    >
      {trade ? (
        <Stack sx={{ height: '100%' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                  <DirectionTag direction={trade.direction} />
                  <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                    {trade.ccyPair}
                  </Typography>
                  <MetaTag label={trade.tenor} />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
                  {trade.id}
                </Typography>
              </Box>
              <IconButton onClick={onClose} size="small" aria-label="Close trade details">
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Economics
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FieldRow label="Quantity" value={`${formatQuantity(trade.qty)} ${trade.dealtCurrency || ''}`} />
              <FieldRow label="Rate" value={formatRate(trade.price)} />
              {trade.swapPoints ? <FieldRow label="Swap points" value={String(trade.swapPoints)} /> : null}
              <FieldRow
                label="You buy"
                value={
                  trade.buyQuantity
                    ? `${formatQuantity(trade.buyQuantity)} ${trade.buyCurrency || ''}`
                    : trade.direction === 'Buy'
                      ? `${formatQuantity(trade.qty)} ${trade.dealtCurrency || ''}`
                      : notional
                        ? `${formatQuantity(notional.amount)} ${notional.currency}`
                        : '—'
                }
              />
              <FieldRow
                label="You sell"
                value={
                  trade.sellQuantity
                    ? `${formatQuantity(trade.sellQuantity)} ${trade.sellCurrency || ''}`
                    : trade.direction === 'Sell'
                      ? `${formatQuantity(trade.qty)} ${trade.dealtCurrency || ''}`
                      : notional
                        ? `${formatQuantity(notional.amount)} ${notional.currency}`
                        : '—'
                }
              />
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Dates
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FieldRow label="Trade date" value={trade.tradeDate || '—'} />
              <FieldRow label="Settlement" value={trade.settlementDate || '—'} />
              <FieldRow label="Booked" value={formatDateTime(trade.bookedAt)} />
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Parties
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FieldRow label="Customer" value={trade.customer || '—'} />
              <FieldRow label="Relationship manager" value={trade.rm || '—'} />
              <FieldRow label="Sales" value={trade.sales || '—'} />
              <FieldRow label="Trader" value={trade.trader || '—'} />
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              Capture
            </Typography>
            <Box sx={{ pb: 1 }}>
              <FieldRow label="Product" value={getProductLabel(trade)} />
              <FieldRow label="Execution" value={getExecutionLabel(trade)} />
              <FieldRow label="Booking" value={getCaptureLabel(trade)} />
              <FieldRow label="Market source" value={trade.marketSource || '—'} />
              {trade.productDetails ? <FieldRow label="Structure" value={trade.productDetails} /> : null}
              {trade.comments ? <FieldRow label="Comments" value={trade.comments} /> : null}
            </Box>
          </Box>
        </Stack>
      ) : null}
    </Drawer>
  );
}

export default TradeDetailDrawer;
