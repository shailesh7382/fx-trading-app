import type { SvgIconComponent } from '@mui/icons-material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import type { AppNotification } from '@/shared/types';

export { monoFont } from '@/shared/trading/tokens';

export const categoryLabels: Record<string, string> = {
  ALL: 'All',
  TRADE: 'Trades',
  ORDER_EXECUTION: 'Executions',
  ORDER_STATUS: 'Order status',
  MARKET_COMMENTARY: 'Market',
};

export const categoryOrder = ['ALL', 'TRADE', 'ORDER_EXECUTION', 'ORDER_STATUS', 'MARKET_COMMENTARY'];

const categoryIcons: Record<string, SvgIconComponent> = {
  TRADE: ReceiptLongRoundedIcon,
  ORDER_EXECUTION: BoltRoundedIcon,
  ORDER_STATUS: PendingActionsRoundedIcon,
  MARKET_COMMENTARY: InsightsRoundedIcon,
};

export function getCategoryIcon(category: string): SvgIconComponent {
  return categoryIcons[category] || NotificationsRoundedIcon;
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

export interface SeverityToken {
  fg: string;
  bg: string;
  border: string;
}

/**
 * Severity colours for the feed.
 *
 * The application theme maps success, warning and error onto the same blue, so a
 * warning reads exactly like a confirmation. These scoped tokens restore the
 * distinction without touching the global palette.
 */
export const severityTokens: Record<string, SeverityToken> = {
  success: { fg: '#116149', bg: '#E7F4EF', border: '#BADFD0' },
  warning: { fg: '#8A5A11', bg: '#FBF2E3', border: '#EBD6AC' },
  error: { fg: '#9C3B2E', bg: '#FBEDEA', border: '#EFCCC4' },
  primary: { fg: '#1B4F8A', bg: '#EAF1FA', border: '#C2D7EE' },
  info: { fg: '#5A6875', bg: '#F1F4F7', border: '#DCE3EA' },
};

export function getSeverityToken(severity: string | undefined): SeverityToken {
  return severityTokens[severity || 'info'] || severityTokens.info;
}

/** Day bucket a notification belongs to, as the feed labels it. */
export function getDayLabel(timestamp: string | undefined): string {
  if (!timestamp) {
    return 'Undated';
  }

  const received = new Date(timestamp);

  if (Number.isNaN(received.getTime())) {
    return 'Undated';
  }

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startOfDay(new Date()) - startOfDay(received)) / 86400000);

  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).format(received);
}

export interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

/** Groups a feed into day buckets, newest first, preserving order inside each day. */
export function groupByDay(notifications: AppNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];

  notifications.forEach((notification) => {
    const label = getDayLabel(notification.createdAt);
    const current = groups[groups.length - 1];

    if (current && current.label === label) {
      current.items.push(notification);
      return;
    }

    groups.push({ label, items: [notification] });
  });

  return groups;
}
