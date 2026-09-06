import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { useOutletContext } from 'react-router-dom';
import { extractApiMessage, fetchLimitOrders } from '../api/client';
import { formatDateTime, formatNotional, formatRate } from '../utils/formatters';

const statusOptions = ['ALL', 'ACTIVE', 'EXECUTED', 'EXPIRED', 'CANCELLED'];
const gridTemplate = 'minmax(180px, 1.35fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr) minmax(105px, 0.7fr) minmax(130px, 0.9fr) minmax(165px, 1.1fr)';
const subtleBorder = '1px solid #D9E1EA';

const statusPresentation = {
  ACTIVE: { color: 'primary', variant: 'filled' },
  EXECUTED: { color: 'success', variant: 'filled' },
  EXPIRED: { color: 'warning', variant: 'outlined' },
  CANCELLED: { color: 'default', variant: 'outlined' },
};

function StatusChip({ status }) {
  const presentation = statusPresentation[status] || statusPresentation.CANCELLED;

  return (
    <Chip
      label={status}
      size="small"
      color={presentation.color}
      variant={presentation.variant}
      sx={{ height: 24, '& .MuiChip-label': { px: 1, fontSize: '0.7rem', fontWeight: 600 } }}
    />
  );
}

function OrderCell({ label, children, sx = {} }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      {label ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'block', md: 'none' }, mb: 0.35, fontSize: '0.68rem' }}
        >
          {label}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}

function FXLimitOrders() {
  const { refresh } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async ({ keepSpinner = false } = {}) => {
    if (!keepSpinner) {
      setIsLoading(true);
    }

    try {
      const allOrders = await fetchLimitOrders({ view: 'ALL' });
      setOrders(Array.isArray(allOrders) ? allOrders : []);
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
    const intervalId = window.setInterval(() => {
      loadOrders({ keepSpinner: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders
      .filter((order) => statusFilter === 'ALL' || order.status === statusFilter)
      .filter((order) => {
        if (!query) return true;

        return [order.id, order.ccyPair, order.direction, order.trader, order.comments, order.status]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => new Date(right.submittedAt || 0) - new Date(left.submittedAt || 0));
  }, [orders, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      active: orders.filter((order) => order.status === 'ACTIVE').length,
      executed: orders.filter((order) => order.status === 'EXECUTED').length,
      expired: orders.filter((order) => order.status === 'EXPIRED').length,
      cancelled: orders.filter((order) => order.status === 'CANCELLED').length,
    }),
    [orders]
  );

  const handleRefresh = async () => {
    await Promise.all([loadOrders({ keepSpinner: true }), refresh?.()]);
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.75, md: 2.5 } }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <Box>
              <Typography variant="h4" sx={{ fontSize: { xs: '1.55rem', md: '2.125rem' } }}>All limit orders</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                Order status and execution history.
              </Typography>
            </Box>
            <IconButton
              aria-label="Refresh orders"
              color="primary"
              onClick={handleRefresh}
              disabled={isLoading}
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: subtleBorder }}
            >
              <SyncRoundedIcon fontSize="small" />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<SyncRoundedIcon />}
              onClick={handleRefresh}
              disabled={isLoading}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        {isLoading ? <LinearProgress sx={{ height: 2 }} /> : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
            borderTop: subtleBorder,
            bgcolor: 'background.default',
          }}
        >
          {[
            { label: 'Active', value: metrics.active },
            { label: 'Executed', value: metrics.executed },
            { label: 'Expired', value: metrics.expired },
            { label: 'Cancelled', value: metrics.cancelled },
          ].map((metric, index) => (
            <Box
              key={metric.label}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: { xs: 1.2, md: 1.5 },
                borderLeft: {
                  xs: index % 2 ? subtleBorder : 'none',
                  sm: index ? subtleBorder : 'none',
                },
                borderTop: { xs: index > 1 ? subtleBorder : 'none', sm: 'none' },
              }}
            >
              <Typography color="text.secondary" variant="caption">
                {metric.label}
              </Typography>
              <Typography sx={{ mt: 0.15, fontSize: { xs: '1.35rem', md: '1.55rem' }, lineHeight: 1.2, fontWeight: 650 }}>
                {metric.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Paper sx={{ p: { xs: 1.25, md: 2 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1, sm: 1.25 },
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 1fr) 220px auto' },
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            label="Search orders"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order, pair, or trader"
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
          <TextField
            select
            size="small"
            label="Order status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((statusOption) => (
              <MenuItem key={statusOption} value={statusOption}>
                {statusOption === 'ALL' ? 'All statuses' : statusOption}
              </MenuItem>
            ))}
          </TextField>
          <Typography color="text.secondary" variant="body2" sx={{ whiteSpace: 'nowrap', textAlign: { sm: 'right' } }}>
            {visibleOrders.length} visible · {orders.length} total
          </Typography>
        </Box>
      </Paper>

      <Paper
        sx={{
          overflow: 'hidden',
          bgcolor: { xs: 'transparent', md: 'background.paper' },
          border: { xs: 'none', md: subtleBorder },
          boxShadow: 'none',
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: gridTemplate,
            gap: 1,
            px: 2,
            py: 1.15,
            bgcolor: 'background.default',
            borderBottom: subtleBorder,
          }}
        >
          {['Order / instrument', 'Quantity', 'Limit / fill', 'TIF', 'Status', 'Trader', 'Submitted'].map((label) => (
            <Typography key={label} color="text.secondary" variant="caption" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
          ))}
        </Box>

        {visibleOrders.length ? (
          visibleOrders.map((order, index) => (
            <Box
              key={order.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: gridTemplate },
                gap: { xs: 1.5, md: 1 },
                alignItems: 'center',
                px: 2,
                py: { xs: 1.75, md: 1.5 },
                mb: { xs: 1, md: 0 },
                bgcolor: 'background.paper',
                border: { xs: subtleBorder, md: 'none' },
                borderTop: { xs: subtleBorder, md: index ? subtleBorder : 'none' },
                borderRadius: { xs: 1, md: 0 },
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <OrderCell label={null} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                      {order.ccyPair} · {order.direction}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      variant="caption"
                      sx={{ display: 'block', mt: 0.2, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                    >
                      {order.id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <StatusChip status={order.status} />
                  </Box>
                </Stack>
              </OrderCell>

              <OrderCell label="Quantity">
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatNotional(order.qty)} {order.dealtCurrency}
                </Typography>
              </OrderCell>

              <OrderCell label="Limit / fill">
                <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatRate(order.limitPrice)}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {order.executedPrice ? `Fill ${formatRate(order.executedPrice)}` : 'Not filled'}
                </Typography>
              </OrderCell>

              <OrderCell label="Time in force">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {order.timeInForce}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {order.timeInForce === 'GTD' ? order.goodTillDate || 'Today' : 'Open-ended'}
                </Typography>
              </OrderCell>

              <OrderCell label="Status" sx={{ display: { xs: 'none', md: 'block' } }}>
                <StatusChip status={order.status} />
              </OrderCell>

              <OrderCell label="Trader">
                <Typography variant="body2" noWrap>
                  {order.trader || 'system'}
                </Typography>
              </OrderCell>

              <OrderCell label="Submitted" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                <Typography variant="body2">{formatDateTime(order.submittedAt)}</Typography>
                {order.executedAt ? (
                  <Typography color="text.secondary" variant="caption">
                    Executed {formatDateTime(order.executedAt)}
                  </Typography>
                ) : null}
              </OrderCell>
            </Box>
          ))
        ) : (
          <Box sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
            <Typography variant="h6">No matching orders</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              Adjust the search or status filter.
            </Typography>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

export default FXLimitOrders;
