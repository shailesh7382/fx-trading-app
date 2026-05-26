import React, { useMemo, useState } from 'react';
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
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useOutletContext } from 'react-router-dom';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';

const categoryLabels = {
  ALL: 'All activity',
  TRADE: 'Trade bookings',
  ORDER_EXECUTION: 'Order executions',
  ORDER_STATUS: 'Order status',
  MARKET_COMMENTARY: 'Market commentary',
};

const severityColorMap = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  primary: 'primary',
  info: 'default',
};

function FXNotifications() {
  const {
    notifications = [],
    notificationCount = 0,
    isLoading,
    error,
    lastUpdated,
    refresh,
  } = useOutletContext();
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categoryOptions = useMemo(
    () => ['ALL', 'TRADE', 'ORDER_EXECUTION', 'ORDER_STATUS', 'MARKET_COMMENTARY'],
    []
  );

  const metrics = useMemo(
    () => ({
      trades: notifications.filter((notification) => notification.category === 'TRADE').length,
      executions: notifications.filter((notification) => notification.category === 'ORDER_EXECUTION').length,
      orderStatus: notifications.filter((notification) => notification.category === 'ORDER_STATUS').length,
      commentary: notifications.filter((notification) => notification.category === 'MARKET_COMMENTARY').length,
    }),
    [notifications]
  );

  const visibleNotifications = useMemo(() => {
    if (categoryFilter === 'ALL') {
      return notifications;
    }

    return notifications.filter((notification) => notification.category === categoryFilter);
  }, [categoryFilter, notifications]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">Notifications</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Server-generated updates for trade capture, order lifecycle events, and live market commentary.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={() => refresh?.()}>
              Refresh feed
            </Button>
          </Stack>

          {isLoading ? <LinearProgress /> : null}
          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Chip icon={<NotificationsRoundedIcon />} label={`${notificationCount} in feed`} color="primary" />
            <Chip label={`Last workspace update ${formatRelativeTime(lastUpdated)}`} variant="outlined" />
          </Stack>

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
            {[
              { label: 'Trade bookings', value: metrics.trades },
              { label: 'Order executions', value: metrics.executions },
              { label: 'Order status', value: metrics.orderStatus },
              { label: 'Market commentary', value: metrics.commentary },
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

          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '300px 1fr' } }}>
            <TextField
              select
              label="Notification category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categoryOptions.map((category) => (
                <MenuItem key={category} value={category}>
                  {categoryLabels[category]}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" gap={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={`${visibleNotifications.length} visible`} size="small" color="primary" variant="outlined" />
              <Chip label={`${notifications.length} total`} size="small" variant="outlined" />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
            <Paper key={notification.id} sx={{ p: { xs: 2, md: 2.25 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)' },
                  alignItems: 'start',
                }}
              >
                <Stack spacing={1.2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">{notification.title}</Typography>
                      <Typography color="text.secondary">{notification.message}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={categoryLabels[notification.category] || notification.category} size="small" variant="outlined" />
                      <Chip label={notification.unread ? 'New' : 'Seen'} size="small" color={notification.unread ? 'primary' : 'default'} />
                    </Stack>
                  </Stack>

                  <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      label={notification.severity || 'info'}
                      size="small"
                      color={severityColorMap[notification.severity] || 'default'}
                    />
                    {notification.source ? <Chip label={notification.source} size="small" variant="outlined" /> : null}
                    {notification.relatedId ? <Chip label={notification.relatedId} size="small" variant="outlined" /> : null}
                  </Stack>
                </Stack>

                <Paper sx={{ p: 1.5, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Received</Typography>
                      <Typography>{formatDateTime(notification.createdAt)}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Relative</Typography>
                      <Typography>{formatRelativeTime(notification.createdAt)}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">Category</Typography>
                      <Typography>{categoryLabels[notification.category] || notification.category}</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Paper>
          ))
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">No notifications match this filter</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Adjust the category filter to review trade flow, order activity, or market commentary items.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}

export default FXNotifications;

