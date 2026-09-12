import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import {
  amendLimitOrder,
  cancelLimitOrder,
  extractApiMessage,
  fetchLimitOrders,
} from '@/shared/api/client';
import { useWorkspaceContext } from '@/features/workspace/useWorkspaceData';
import type { LimitOrder, LimitOrderAmendment, LimitOrderStatus } from '@/shared/types';
import { downloadCsv } from '@/shared/utils/csv';
import { formatDateTime, formatRate, formatRelativeTime } from '@/shared/utils/formatters';
import AmendOrderDialog from './AmendOrderDialog';
import CancelOrderDialog from './CancelOrderDialog';
import OrderDetailDrawer from './OrderDetailDrawer';
import { DirectionTag, StatusTag } from './OrderTags';
import {
  formatPips,
  formatQuantity,
  formatTimeInForce,
  getLimitDistance,
  getStatusToken,
  isOrderOpen,
} from './presentation';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, monospace';

type StatusFilter = 'ALL' | LimitOrderStatus;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Working' },
  { value: 'EXECUTED', label: 'Filled' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

type SortKey = 'submittedAt' | 'ccyPair' | 'qty' | 'limitPrice' | 'status';
type SortDirection = 'asc' | 'desc';

interface ColumnDefinition {
  key: SortKey | null;
  label: string;
  align?: 'left' | 'right';
  /** Columns that only earn their width once there is room for them. */
  hideBelow?: 'lg' | 'xl';
  width?: number;
}

const columns: ColumnDefinition[] = [
  { key: 'ccyPair', label: 'Instrument' },
  { key: null, label: 'Side', width: 76 },
  { key: 'qty', label: 'Quantity', align: 'right' },
  { key: 'limitPrice', label: 'Limit', align: 'right' },
  { key: null, label: 'Distance', align: 'right', hideBelow: 'lg' },
  { key: null, label: 'Fill', align: 'right' },
  { key: null, label: 'TIF', hideBelow: 'lg' },
  { key: 'status', label: 'Status', width: 118 },
  { key: null, label: 'Trader', hideBelow: 'xl' },
  { key: 'submittedAt', label: 'Submitted', align: 'right' },
];

function sortValue(order: LimitOrder, key: SortKey): number | string {
  switch (key) {
    case 'submittedAt':
      return new Date(order.submittedAt || 0).getTime();
    case 'qty':
      return Number(order.qty || 0);
    case 'limitPrice':
      return Number(order.limitPrice || 0);
    case 'status':
      return String(order.status || '');
    case 'ccyPair':
    default:
      return String(order.ccyPair || '');
  }
}

function StatTile({ label, value, caption, accent }: { label: string; value: string; caption?: string; accent?: string }) {
  return (
    <Paper
      sx={{
        px: { xs: 1.25, md: 2 },
        py: { xs: 1, md: 1.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.35,
        borderLeft: accent ? '3px solid' : undefined,
        borderLeftColor: accent,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.4rem' }, fontWeight: 650, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      {caption ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {caption}
        </Typography>
      ) : null}
    </Paper>
  );
}

function DistanceCell({ order }: { order: LimitOrder }) {
  const distance = getLimitDistance(order);

  if (!distance) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }

  if (distance.throughLimit) {
    return (
      <Typography variant="body2" sx={{ fontWeight: 650, color: '#12855C' }}>
        Through
      </Typography>
    );
  }

  const isClose = distance.pips <= 10;

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: isClose ? 650 : 400, color: isClose ? '#B3801F' : 'text.primary' }}
      >
        {formatPips(distance.pips)} pips
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        mkt {formatRate(order.lastEvaluatedPrice || 0)}
      </Typography>
    </Box>
  );
}

function LimitOrders() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { manualRefreshToken } = useWorkspaceContext();

  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [amendingOrderId, setAmendingOrderId] = useState<string>('');
  const [pendingCancelId, setPendingCancelId] = useState<string>('');
  const [busyOrderId, setBusyOrderId] = useState<string>('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuOrderId, setMenuOrderId] = useState<string>('');

  // Background polling must not pull the rug out from under an open ticket.
  const isEditingRef = useRef(false);
  isEditingRef.current = Boolean(amendingOrderId || pendingCancelId);

  const loadOrders = useCallback(async ({ keepSpinner = false }: { keepSpinner?: boolean } = {}) => {
    if (!keepSpinner) {
      setIsLoading(true);
    }

    try {
      const allOrders = await fetchLimitOrders({ view: 'ALL' });
      setOrders(Array.isArray(allOrders) ? allOrders : []);
      setLastSyncedAt(new Date().toISOString());
      setError('');
    } catch (loadError) {
      setError(extractApiMessage(loadError, 'Unable to load limit orders.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!manualRefreshToken) {
      return;
    }

    loadOrders({ keepSpinner: true });
  }, [loadOrders, manualRefreshToken]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isEditingRef.current) {
        return;
      }

      loadOrders({ keepSpinner: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadOrders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };

    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });

    return counts;
  }, [orders]);

  /** Count, notional and most recent activity per state, for the summary tiles. */
  const statusSummary = useMemo(() => {
    const summarise = (status: LimitOrderStatus) => {
      const subset = orders.filter((order) => order.status === status);
      const timestamps = subset
        .map((order) => order.closedAt || order.executedAt || order.submittedAt || '')
        .filter(Boolean)
        .sort();

      return {
        count: subset.length,
        notional: subset.reduce((total, order) => total + Number(order.qty || 0), 0),
        latest: timestamps[timestamps.length - 1] || '',
      };
    };

    return {
      ACTIVE: summarise('ACTIVE'),
      EXECUTED: summarise('EXECUTED'),
      EXPIRED: summarise('EXPIRED'),
      CANCELLED: summarise('CANCELLED'),
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const factor = sortDirection === 'asc' ? 1 : -1;

    return orders
      .filter((order) => statusFilter === 'ALL' || order.status === statusFilter)
      .filter((order) => {
        if (!query) return true;

        return [order.id, order.ccyPair, order.direction, order.trader, order.comments, order.status]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftValue = sortValue(left, sortKey);
        const rightValue = sortValue(right, sortKey);

        if (leftValue < rightValue) return -1 * factor;
        if (leftValue > rightValue) return 1 * factor;

        return 0;
      });
  }, [orders, search, sortDirection, sortKey, statusFilter]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const amendingOrder = useMemo(
    () => orders.find((order) => order.id === amendingOrderId) || null,
    [orders, amendingOrderId]
  );

  const pendingCancelOrder = useMemo(
    () => orders.find((order) => order.id === pendingCancelId) || null,
    [orders, pendingCancelId]
  );

  const menuOrder = useMemo(
    () => orders.find((order) => order.id === menuOrderId) || null,
    [orders, menuOrderId]
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'submittedAt' ? 'desc' : 'asc');
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuOrderId('');
  };

  const handleAmendSubmit = async (orderId: string, amendment: LimitOrderAmendment) => {
    setBusyOrderId(orderId);

    try {
      const updatedOrder = await amendLimitOrder(orderId, amendment);
      setFeedback({
        severity: 'success',
        message:
          updatedOrder.status === 'EXECUTED'
            ? `Order ${updatedOrder.id} was amended and filled immediately.`
            : `Order ${updatedOrder.id} amended.`,
      });
      setAmendingOrderId('');
      await loadOrders({ keepSpinner: true });
    } catch (amendError) {
      setFeedback({
        severity: 'error',
        message: extractApiMessage(amendError, 'Unable to amend the limit order right now.'),
      });
    } finally {
      setBusyOrderId('');
    }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelOrder) {
      return;
    }

    const orderId = pendingCancelOrder.id;
    setBusyOrderId(orderId);

    try {
      const cancelledOrder = await cancelLimitOrder(orderId);
      setFeedback({ severity: 'success', message: `Order ${cancelledOrder.id} cancelled.` });
      setPendingCancelId('');
      await loadOrders({ keepSpinner: true });
    } catch (cancelError) {
      setFeedback({
        severity: 'error',
        message: extractApiMessage(cancelError, 'Unable to cancel the limit order right now.'),
      });
    } finally {
      setBusyOrderId('');
    }
  };

  const copyOrderId = async (orderId: string) => {
    try {
      await navigator.clipboard?.writeText(orderId);
      setFeedback({ severity: 'success', message: `Copied ${orderId}.` });
    } catch {
      setFeedback({ severity: 'error', message: 'Clipboard is unavailable in this browser.' });
    }
  };

  const exportOrders = () => {
    downloadCsv(
      'fx-limit-orders.csv',
      visibleOrders.map((order) => ({
        OrderId: order.id,
        Pair: order.ccyPair,
        Direction: order.direction,
        Quantity: order.qty,
        DealtCurrency: order.dealtCurrency,
        LimitPrice: order.limitPrice,
        ExecutedPrice: order.executedPrice ?? '',
        TimeInForce: order.timeInForce,
        GoodTillDate: order.goodTillDate ?? '',
        Status: order.status,
        Trader: order.trader ?? '',
        SubmittedAt: order.submittedAt ?? '',
        ExecutedAt: order.executedAt ?? '',
        LastEvaluatedAt: order.lastEvaluatedAt ?? '',
        LastEvaluatedPrice: order.lastEvaluatedPrice ?? '',
        SimulatorTradeId: order.simulatorTradeId ?? '',
        Comments: order.comments ?? '',
      }))
    );
  };

  const emptyState = (
    <Stack spacing={1} sx={{ alignItems: 'center', px: 3, py: { xs: 5, md: 8 }, textAlign: 'center' }}>
      <InboxRoundedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
      <Typography variant="subtitle1">No matching orders</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 320 }}>
        {orders.length
          ? 'Nothing matches the current search or status filter.'
          : 'Resting orders placed from the rates screen will appear here.'}
      </Typography>
      {orders.length && (search || statusFilter !== 'ALL') ? (
        <Button
          size="small"
          onClick={() => {
            setSearch('');
            setStatusFilter('ALL');
          }}
          sx={{ mt: 0.5 }}
        >
          Clear filters
        </Button>
      ) : null}
    </Stack>
  );

  const loadingRows = (
    <Stack spacing={1} sx={{ p: 2 }}>
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} variant="rounded" height={isCompact ? 92 : 44} />
      ))}
    </Stack>
  );

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      {error ? (
        <Alert severity="warning" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      {feedback ? (
        <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1, md: 1.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <StatTile
          label="Working"
          value={String(statusSummary.ACTIVE.count)}
          caption={
            statusSummary.ACTIVE.count
              ? `${formatQuantity(statusSummary.ACTIVE.notional)} resting`
              : 'Nothing resting'
          }
          accent={getStatusToken('ACTIVE').dot}
        />
        <StatTile
          label="Filled"
          value={String(statusSummary.EXECUTED.count)}
          caption={
            statusSummary.EXECUTED.latest
              ? `Last fill ${formatRelativeTime(statusSummary.EXECUTED.latest)}`
              : 'No fills yet'
          }
          accent={getStatusToken('EXECUTED').dot}
        />
        <StatTile
          label="Expired"
          value={String(statusSummary.EXPIRED.count)}
          caption={
            statusSummary.EXPIRED.latest
              ? `Last ${formatRelativeTime(statusSummary.EXPIRED.latest)}`
              : 'None expired'
          }
          accent={getStatusToken('EXPIRED').dot}
        />
        <StatTile
          label="Cancelled"
          value={String(statusSummary.CANCELLED.count)}
          caption={
            statusSummary.CANCELLED.latest
              ? `Last ${formatRelativeTime(statusSummary.CANCELLED.latest)}`
              : 'None cancelled'
          }
          accent={getStatusToken('CANCELLED').dot}
        />
      </Box>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1, md: 1.5 },
            gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(240px, 360px) 1fr auto' },
            alignItems: 'center',
            px: { xs: 1.5, md: 2 },
            pt: { xs: 1.5, md: 1.75 },
            pb: { xs: 1, md: 1.25 },
          }}
        >
          <TextField
            size="small"
            label="Search orders"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order ID, pair, or trader"
            sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{ whiteSpace: 'nowrap', textAlign: { xs: 'left', md: 'right' }, fontVariantNumeric: 'tabular-nums' }}
          >
            {visibleOrders.length} shown · {orders.length} total
            {lastSyncedAt ? ` · synced ${formatRelativeTime(lastSyncedAt)}` : ''}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<DownloadRoundedIcon />}
            onClick={exportOrders}
            disabled={!visibleOrders.length}
            sx={{ whiteSpace: 'nowrap', justifySelf: { xs: 'start', md: 'end' } }}
          >
            Export
          </Button>
        </Box>

        <Tabs
          value={statusFilter}
          onChange={(_event, value: StatusFilter) => setStatusFilter(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Order status"
          sx={{
            minHeight: 40,
            px: { xs: 0.75, md: 1.25 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 40,
              minWidth: 0,
              px: 1.5,
              fontSize: '0.82rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          {statusFilters.map((filter) => (
            <Tab
              key={filter.value}
              value={filter.value}
              label={`${filter.label} (${statusCounts[filter.value] || 0})`}
            />
          ))}
        </Tabs>

        {isLoading && !orders.length ? (
          loadingRows
        ) : !visibleOrders.length ? (
          emptyState
        ) : isCompact ? (
          <Stack divider={<Divider />}>
            {visibleOrders.map((order) => {
              const distance = getLimitDistance(order);

              return (
                <Box
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrderId(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedOrderId(order.id);
                    }
                  }}
                  sx={{
                    px: 1.75,
                    py: 1.5,
                    cursor: 'pointer',
                    borderLeft: '3px solid',
                    borderLeftColor: getStatusToken(order.status).dot,
                    '&:active': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <DirectionTag direction={order.direction} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                        {order.ccyPair}
                      </Typography>
                    </Stack>
                    <StatusTag status={order.status} dense />
                  </Stack>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, maxWidth: 460 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        Quantity
                      </Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatQuantity(order.qty)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        Limit
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRate(order.limitPrice)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        {order.executedPrice ? 'Fill' : 'Distance'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {order.executedPrice
                          ? formatRate(order.executedPrice)
                          : distance
                            ? distance.throughLimit
                              ? 'Through'
                              : `${formatPips(distance.pips)} pips`
                            : '—'}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 1 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ fontFamily: monoFont, minWidth: 0 }}
                    >
                      {order.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {formatTimeInForce(order)} · {formatRelativeTime(order.submittedAt)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <TableContainer sx={{ maxHeight: { md: 'calc(100vh - 360px)' } }}>
            <Table stickyHeader size="small" sx={{ minWidth: 940 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.label}
                      align={column.align || 'left'}
                      sortDirection={column.key && sortKey === column.key ? sortDirection : false}
                      sx={{
                        bgcolor: 'background.default',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        width: column.width,
                        display: column.hideBelow
                          ? { xs: 'none', [column.hideBelow]: 'table-cell' }
                          : undefined,
                      }}
                    >
                      {column.key ? (
                        <TableSortLabel
                          active={sortKey === column.key}
                          direction={sortKey === column.key ? sortDirection : 'asc'}
                          onClick={() => handleSort(column.key as SortKey)}
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                  <TableCell sx={{ bgcolor: 'background.default', width: 52, py: 1 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    selected={order.id === selectedOrderId}
                    onClick={() => setSelectedOrderId(order.id)}
                    sx={{ cursor: 'pointer', '& > td': { borderColor: 'divider' } }}
                  >
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1.3 }}>
                        {order.ccyPair}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ fontFamily: monoFont, display: 'block', maxWidth: 170 }}
                      >
                        {order.id}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ py: 1 }}>
                      <DirectionTag direction={order.direction} />
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1, fontVariantNumeric: 'tabular-nums' }}>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatQuantity(order.qty)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.dealtCurrency}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRate(order.limitPrice)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1, display: { xs: 'none', lg: 'table-cell' } }}>
                      <DistanceCell order={order} />
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1 }}>
                      {order.executedPrice ? (
                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', color: '#12855C', fontWeight: 650 }}>
                          {formatRate(order.executedPrice)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ py: 1, whiteSpace: 'nowrap', display: { xs: 'none', lg: 'table-cell' } }}>
                      <Typography variant="body2">{formatTimeInForce(order)}</Typography>
                    </TableCell>

                    <TableCell sx={{ py: 1 }}>
                      <StatusTag status={order.status} />
                    </TableCell>

                    <TableCell sx={{ py: 1, display: { xs: 'none', xl: 'table-cell' } }}>
                      <Typography variant="body2" noWrap>
                        {order.trader || 'system'}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1, whiteSpace: 'nowrap' }}>
                      <Tooltip title={formatDateTime(order.submittedAt)} placement="left">
                        <Typography variant="body2">{formatRelativeTime(order.submittedAt)}</Typography>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <IconButton
                        size="small"
                        aria-label={`Actions for ${order.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuAnchor(event.currentTarget);
                          setMenuOrderId(order.id);
                        }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setSelectedOrderId(menuOrderId);
            closeMenu();
          }}
        >
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!menuOrder || !isOrderOpen(menuOrder)}
          onClick={() => {
            setAmendingOrderId(menuOrderId);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Amend</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!menuOrder || !isOrderOpen(menuOrder)}
          onClick={() => {
            setPendingCancelId(menuOrderId);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <BlockRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cancel order</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            copyOrderId(menuOrderId);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy order ID</ListItemText>
        </MenuItem>
      </Menu>

      <OrderDetailDrawer
        order={selectedOrder}
        isBusy={Boolean(busyOrderId)}
        onClose={() => setSelectedOrderId('')}
        onAmend={(order) => setAmendingOrderId(order.id)}
        onCancel={(order) => setPendingCancelId(order.id)}
      />

      <AmendOrderDialog
        order={amendingOrder}
        isSaving={Boolean(busyOrderId)}
        onClose={() => setAmendingOrderId('')}
        onSubmit={handleAmendSubmit}
      />

      <CancelOrderDialog
        order={pendingCancelOrder}
        isBusy={Boolean(busyOrderId)}
        onClose={() => setPendingCancelId('')}
        onConfirm={handleCancelConfirm}
      />
    </Stack>
  );
}

export default LimitOrders;
