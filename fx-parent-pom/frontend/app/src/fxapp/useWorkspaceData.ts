import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchFxPrices, fetchLimitOrders, fetchNotifications } from '../api/client';
import { getFallbackRates, simulateMarketSnapshot } from '../data/mockData';
import type { AppNotification, FxRate, LimitOrder, NormalizedRate, NotificationsPayload } from '../types';

export interface RefreshOptions {
  forceRates?: boolean;
}

/** Everything `FXTradingApp` publishes to its routed screens through the router outlet. */
export interface WorkspaceContextValue {
  rates: NormalizedRate[];
  isLoading: boolean;
  isDemo: boolean;
  isRatesStreaming: boolean;
  setRatesStreaming: (streaming: boolean) => void;
  error: string;
  limitOrders: LimitOrder[];
  notifications: AppNotification[];
  notificationCount: number;
  lastUpdated: string;
  manualRefreshToken: number;
  refresh: (options?: RefreshOptions) => Promise<void>;
  requestRefresh: () => Promise<void>;
}

export interface WorkspaceDataOptions {
  autoRefresh?: boolean;
  intervalMs?: number;
}

function normalizeRates(rawRates: FxRate[], previousRates: NormalizedRate[] = []): NormalizedRate[] {
  const previousByPair = new Map(previousRates.map((rate) => [rate.ccyPair, rate]));

  return rawRates.map((rate) => {
    const bid = Number(rate.bid || 0);
    const ask = Number(rate.ask || 0);
    const qty = Number(rate.qty || 0);
    const previous = previousByPair.get(rate.ccyPair);

    return {
      ...rate,
      qty,
      bid,
      ask,
      mid: Number(((bid + ask) / 2).toFixed(bid > 20 ? 3 : 5)),
      spreadPips: Number((((ask - bid) || 0) * (bid > 20 ? 100 : 10000)).toFixed(1)),
      updatedAt: rate.updatedAt || new Date().toISOString(),
      source: rate.source || 'STREAM',
      status: rate.status || 'LIVE',
      bidDelta: previous ? Number((bid - previous.bid).toFixed(bid > 20 ? 3 : 5)) : 0,
      askDelta: previous ? Number((ask - previous.ask).toFixed(bid > 20 ? 3 : 5)) : 0,
    };
  });
}

/** Reads the notification envelope, which the API may send as a bare list. */
function readNotificationsPayload(payload: NotificationsPayload | undefined): {
  notifications: AppNotification[];
  unreadCount: number;
} {
  if (Array.isArray(payload)) {
    return { notifications: payload, unreadCount: payload.length };
  }

  const notifications = Array.isArray(payload?.notifications) ? payload.notifications : [];
  const unreadCount = Number.isFinite(payload?.unreadCount)
    ? (payload?.unreadCount as number)
    : notifications.length;

  return { notifications, unreadCount };
}

export default function useWorkspaceData({
  autoRefresh = true,
  intervalMs = 5000,
}: WorkspaceDataOptions = {}): WorkspaceContextValue {
  const previousRatesRef = useRef<NormalizedRate[]>([]);
  const [rates, setRates] = useState<NormalizedRate[]>(() => normalizeRates(getFallbackRates()));
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isRatesStreaming, setRatesStreaming] = useState(false);
  const [error, setError] = useState('');
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  const [manualRefreshToken, setManualRefreshToken] = useState(0);

  const refresh = useCallback(async ({ forceRates = true }: RefreshOptions = {}) => {
    const tasks: Array<Promise<FxRate[] | LimitOrder[] | NotificationsPayload>> = [
      fetchLimitOrders(),
      fetchNotifications({ limit: 12 }),
    ];

    if (forceRates) {
      tasks.unshift(fetchFxPrices());
    }

    const results = await Promise.allSettled(tasks);
    const ratesResult = forceRates ? results[0] : null;
    const limitOrdersResult = forceRates ? results[1] : results[0];
    const notificationsResult = forceRates ? results[2] : results[1];

    if (forceRates && ratesResult) {
      if (ratesResult.status === 'fulfilled') {
        const liveRates = ratesResult.value as FxRate[];
        const normalized = normalizeRates(liveRates, previousRatesRef.current);
        previousRatesRef.current = normalized;
        setRates(normalized);
        setIsDemo(false);
        setError('');
      } else {
        const simulated = normalizeRates(
          simulateMarketSnapshot(
            previousRatesRef.current.length ? previousRatesRef.current : getFallbackRates()
          ),
          previousRatesRef.current
        );
        previousRatesRef.current = simulated;
        setRates(simulated);
        setIsDemo(true);
        setError('Live pricing is unavailable, so demo liquidity is currently powering the workspace.');
      }
    }

    if (limitOrdersResult?.status === 'fulfilled') {
      const value = limitOrdersResult.value as LimitOrder[];
      setLimitOrders(Array.isArray(value) ? value : []);
    }

    if (notificationsResult?.status === 'fulfilled') {
      const payload = readNotificationsPayload(notificationsResult.value as NotificationsPayload);
      setNotifications(payload.notifications);
      setNotificationCount(payload.unreadCount);
    }

    setLastUpdated(new Date().toISOString());
    setIsLoading(false);
  }, []);

  const requestRefresh = useCallback(async () => {
    setManualRefreshToken((currentToken) => currentToken + 1);
    await refresh({ forceRates: true });
  }, [refresh]);

  useEffect(() => {
    refresh({ forceRates: true });
  }, [refresh]);

  useEffect(() => {
    if (!isRatesStreaming) {
      return undefined;
    }

    refresh({ forceRates: true });
    return undefined;
  }, [isRatesStreaming, refresh]);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refresh({ forceRates: isRatesStreaming });
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, intervalMs, isRatesStreaming, refresh]);

  return {
    rates,
    isLoading,
    isDemo,
    isRatesStreaming,
    setRatesStreaming,
    error,
    limitOrders,
    notifications,
    notificationCount,
    lastUpdated,
    manualRefreshToken,
    refresh,
    requestRefresh,
  };
}

/** Typed view of the workspace data that `FXTradingApp` passes down the router outlet. */
export function useWorkspaceContext(): WorkspaceContextValue {
  return useOutletContext<WorkspaceContextValue>();
}
