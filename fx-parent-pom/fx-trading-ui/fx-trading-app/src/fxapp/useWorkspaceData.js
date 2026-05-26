import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFxPrices, fetchLimitOrders, fetchNotifications } from '../api/client';
import { getFallbackRates, simulateMarketSnapshot } from '../data/mockData';

function normalizeRates(rawRates, previousRates = []) {
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

export default function useWorkspaceData({ autoRefresh = true, intervalMs = 5000 } = {}) {
  const previousRatesRef = useRef([]);
  const [rates, setRates] = useState(() => normalizeRates(getFallbackRates()));
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isRatesStreaming, setRatesStreaming] = useState(false);
  const [error, setError] = useState('');
  const [limitOrders, setLimitOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());

  const refresh = useCallback(async ({ forceRates = true } = {}) => {
    const tasks = [fetchLimitOrders(), fetchNotifications({ limit: 12 })];

    if (forceRates) {
      tasks.unshift(fetchFxPrices());
    }

    const results = await Promise.allSettled(tasks);
    const ratesResult = forceRates ? results[0] : null;
    const limitOrdersResult = forceRates ? results[1] : results[0];
    const notificationsResult = forceRates ? results[2] : results[1];

    if (forceRates && ratesResult) {
      if (ratesResult.status === 'fulfilled') {
        const liveRates = ratesResult.value;
        const normalized = normalizeRates(liveRates, previousRatesRef.current);
        previousRatesRef.current = normalized;
        setRates(normalized);
        setIsDemo(false);
        setError('');
      } else {
        const simulated = normalizeRates(
          simulateMarketSnapshot(previousRatesRef.current.length ? previousRatesRef.current : getFallbackRates()),
          previousRatesRef.current
        );
        previousRatesRef.current = simulated;
        setRates(simulated);
        setIsDemo(true);
        setError('Live pricing is unavailable, so demo liquidity is currently powering the workspace.');
      }
    }

    if (limitOrdersResult.status === 'fulfilled') {
      setLimitOrders(Array.isArray(limitOrdersResult.value) ? limitOrdersResult.value : []);
    }

    if (notificationsResult.status === 'fulfilled') {
      const payload = notificationsResult.value || {};
      const nextNotifications = Array.isArray(payload.notifications)
        ? payload.notifications
        : Array.isArray(payload)
          ? payload
          : [];
      setNotifications(nextNotifications);
      setNotificationCount(Number.isFinite(payload.unreadCount) ? payload.unreadCount : nextNotifications.length);
    }

    setLastUpdated(new Date().toISOString());
    setIsLoading(false);
  }, []);

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
    refresh,
  };
}

