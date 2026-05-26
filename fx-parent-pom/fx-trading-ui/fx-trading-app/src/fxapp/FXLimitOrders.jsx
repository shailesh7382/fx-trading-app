import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { useOutletContext } from 'react-router-dom';
import { extractApiMessage, fetchLimitOrders } from '../api/client';
import { formatDateTime, formatNotional, formatRate } from '../utils/formatters';

const statusOptions = ['ALL', 'ACTIVE', 'EXECUTED', 'EXPIRED', 'CANCELLED'];

function FXLimitOrders() {
  const { refresh } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
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
      setError(extractApiMessage(loadError, 'Unable to load limit order history right now.'));
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
    if (statusFilter === 'ALL') {
      return orders;
    }

    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

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
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">All limit orders</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Review active, executed, expired, and cancelled spot limit orders from one history view.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={handleRefresh}>
              Refresh history
            </Button>
          </Stack>

          {isLoading ? <LinearProgress /> : null}
          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
            {[
              { label: 'Active', value: metrics.active, color: 'primary' },
              { label: 'Executed', value: metrics.executed, color: 'success' },
              { label: 'Expired', value: metrics.expired, color: 'warning' },
              { label: 'Cancelled', value: metrics.cancelled, color: 'default' },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {metric.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.8 }}>
                    {metric.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '280px 1fr' } }}>
            <TextField select label="Order status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((statusOption) => (
                <MenuItem key={statusOption} value={statusOption}>
                  {statusOption === 'ALL' ? 'All statuses' : statusOption}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" gap={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={`${visibleOrders.length} visible`} size="small" color="primary" variant="outlined" />
              <Chip label={`${orders.length} total`} size="small" variant="outlined" />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <Paper key={order.id} sx={{ p: { xs: 2, md: 2.25 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(280px, 0.75fr)' },
                  alignItems: 'start',
                }}
              >
                <Stack spacing={1.2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">
                        {order.direction} {order.ccyPair}
                      </Typography>
                      <Typography color="text.secondary">
                        {formatNotional(order.qty)} · {order.dealtCurrency} · {order.tenor}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={order.status} size="small" color={order.status === 'EXECUTED' ? 'success' : order.status === 'ACTIVE' ? 'primary' : order.status === 'EXPIRED' ? 'warning' : 'default'} />
                      <Chip label={order.timeInForce} size="small" variant="outlined" />
                    </Stack>
                  </Stack>

                  <Typography color="text.secondary">{order.comments || 'No additional limit-order comments captured.'}</Typography>

                  <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`Trader ${order.trader || 'system'}`} variant="outlined" size="small" />
                    <Chip label={`Submitted ${formatDateTime(order.submittedAt)}`} variant="outlined" size="small" />
                    {order.executedAt ? <Chip label={`Executed ${formatDateTime(order.executedAt)}`} variant="outlined" size="small" /> : null}
                  </Stack>
                </Stack>

                <Paper sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Order ID</Typography>
                      <Typography>{order.id}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Limit price</Typography>
                      <Typography>{formatRate(order.limitPrice)}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Good till</Typography>
                      <Typography>{order.timeInForce === 'GTD' ? `Today only (${order.goodTillDate})` : 'Until cancelled'}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Executed price</Typography>
                      <Typography>{order.executedPrice ? formatRate(order.executedPrice) : 'Working'}</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Paper>
          ))
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">No limit orders match this filter</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Adjust the status filter to inspect active, executed, expired, or cancelled orders.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}

export default FXLimitOrders;

