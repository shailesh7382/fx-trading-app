import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { useWorkspaceContext } from '@/features/workspace/useWorkspaceData';
import { MetaTag } from '@/shared/trading/Tags';
import type { AppNotification } from '@/shared/types';
import { formatDateTime, formatRelativeTime } from '@/shared/utils/formatters';
import {
  categoryOrder,
  getCategoryIcon,
  getCategoryLabel,
  getSeverityToken,
  groupByDay,
  monoFont,
} from './presentation';

function FeedItem({ notification }: { notification: AppNotification }) {
  const token = getSeverityToken(notification.severity);
  const CategoryIcon = getCategoryIcon(String(notification.category));
  const isUnread = Boolean(notification.unread);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: { xs: 1.25, md: 1.5 },
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.5 },
        borderLeft: '3px solid',
        borderLeftColor: isUnread ? token.fg : 'transparent',
        bgcolor: isUnread ? 'background.default' : 'background.paper',
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: token.bg,
          border: '1px solid',
          borderColor: token.border,
          color: token.fg,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <CategoryIcon sx={{ fontSize: 16 }} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: isUnread ? 700 : 600, lineHeight: 1.35, minWidth: 0 }}
          >
            {notification.title}
          </Typography>
          <Tooltip title={formatDateTime(notification.createdAt)} placement="left">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.7rem' }}
            >
              {formatRelativeTime(notification.createdAt)}
            </Typography>
          </Tooltip>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.45, maxWidth: 860 }}>
          {notification.message}
        </Typography>

        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ mt: 0.85, flexWrap: 'wrap', alignItems: 'center', maxWidth: 860 }}
        >
          <MetaTag label={getCategoryLabel(String(notification.category))} />
          {notification.severity && notification.severity !== 'info' ? (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.75,
                height: 19,
                borderRadius: 0.75,
                bgcolor: token.bg,
                border: '1px solid',
                borderColor: token.border,
                color: token.fg,
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {notification.severity}
            </Box>
          ) : null}
          {notification.source ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {notification.source}
            </Typography>
          ) : null}
          {notification.relatedId ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.68rem', fontFamily: monoFont }}
            >
              {notification.relatedId}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}

function Notifications() {
  const {
    notifications = [],
    notificationCount = 0,
    isLoading,
    error,
    lastUpdated,
  } = useWorkspaceContext();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: notifications.length };

    notifications.forEach((notification) => {
      const key = String(notification.category);
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [notifications]);

  const unreadTotal = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => categoryFilter === 'ALL' || notification.category === categoryFilter)
        .filter((notification) => !unreadOnly || notification.unread),
    [categoryFilter, notifications, unreadOnly]
  );

  const groups = useMemo(() => groupByDay(visibleNotifications), [visibleNotifications]);

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Paper
        sx={{
          px: { xs: 1.5, md: 2 },
          py: { xs: 1, md: 1.15 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: unreadTotal ? '#2563A8' : '#8C9AA8',
              flexShrink: 0,
            }}
          />
          <Typography component="h2" variant="body2" sx={{ fontWeight: 700 }}>
            {notificationCount || unreadTotal} unread
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            · {notifications.length} in feed · updated {formatRelativeTime(lastUpdated)}
          </Typography>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              slotProps={{ input: { 'aria-label': 'Unread only' } }}
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Unread only
            </Typography>
          }
          sx={{ mr: 0 }}
        />
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        <Tabs
          value={categoryFilter}
          onChange={(_event, value: string) => setCategoryFilter(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Notification category"
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
          {categoryOrder.map((category) => (
            <Tab
              key={category}
              value={category}
              label={`${getCategoryLabel(category)} (${categoryCounts[category] || 0})`}
            />
          ))}
        </Tabs>

        {isLoading && !notifications.length ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            {[0, 1, 2, 3].map((placeholder) => (
              <Skeleton key={placeholder} variant="rounded" height={64} />
            ))}
          </Stack>
        ) : groups.length ? (
          groups.map((group) => (
            <Box key={group.label}>
              <Typography
                component="h3"
                sx={{
                  px: { xs: 1.5, md: 2 },
                  py: 0.75,
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  bgcolor: 'background.default',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {group.label}
              </Typography>
              {group.items.map((notification) => (
                <Box
                  key={notification.id}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}
                >
                  <FeedItem notification={notification} />
                </Box>
              ))}
            </Box>
          ))
        ) : (
          <Stack spacing={1} sx={{ alignItems: 'center', px: 3, py: { xs: 5, md: 8 }, textAlign: 'center' }}>
            <NotificationsNoneRoundedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
            <Typography variant="subtitle1">Nothing to show</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 320 }}>
              {notifications.length
                ? 'No notifications match the current filters.'
                : 'Trade, order and market updates will appear here as they arrive.'}
            </Typography>
            {notifications.length && (unreadOnly || categoryFilter !== 'ALL') ? (
              <Button
                size="small"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setUnreadOnly(false);
                }}
                sx={{ mt: 0.5 }}
              >
                Clear filters
              </Button>
            ) : null}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

export default Notifications;
