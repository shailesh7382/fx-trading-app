import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTrades, loginUser, submitTrade } from '../api/client';
import { createDemoUser, sampleTrades } from '../data/mockData';

const USER_STORAGE_KEY = 'fx-trading-app:user';
const TRADE_STORAGE_KEY = 'fx-trading-app:trades';

const UserContext = createContext(null);

function readJsonStorage(storage, key, fallbackValue) {
  try {
    const storedValue = storage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function sortTrades(trades) {
  return [...trades].sort((left, right) => new Date(right.bookedAt || 0).getTime() - new Date(left.bookedAt || 0).getTime());
}

function mergeTrades(serverTrades = [], currentTrades = []) {
  const tradesById = new Map();

  [...currentTrades, ...serverTrades].forEach((trade) => {
    if (!trade?.id) {
      return;
    }

    tradesById.set(trade.id, {
      ...tradesById.get(trade.id),
      ...trade,
    });
  });

  return sortTrades([...tradesById.values()]);
}

function UserProvider({ children }) {
  const [userDetails, setUserDetails] = useState(() => readJsonStorage(sessionStorage, USER_STORAGE_KEY, null));
  const [trades, setTrades] = useState(() => readJsonStorage(localStorage, TRADE_STORAGE_KEY, sampleTrades));

  useEffect(() => {
    if (userDetails) {
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userDetails));
      return;
    }

    sessionStorage.removeItem(USER_STORAGE_KEY);
  }, [userDetails]);

  useEffect(() => {
    localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(trades));
  }, [trades]);

  const syncTrades = useCallback(async () => {
    try {
      const liveTrades = await fetchTrades();
      setTrades((currentTrades) => mergeTrades(liveTrades, currentTrades));
    } catch (error) {
      // Keep the locally stored blotter when the API is unavailable.
    }
  }, []);

  useEffect(() => {
    syncTrades();

    const intervalId = window.setInterval(syncTrades, 5000);
    return () => window.clearInterval(intervalId);
  }, [syncTrades]);

  const login = useCallback(async (credentials) => {
    const authenticatedUser = await loginUser(credentials);
    setUserDetails(authenticatedUser);
    return authenticatedUser;
  }, []);

  const startDemoSession = useCallback((username) => {
    const demoUser = createDemoUser(username || 'demo.trader');
    setUserDetails(demoUser);
    return demoUser;
  }, []);

  const logout = useCallback(() => {
    setUserDetails(null);
  }, []);

  const bookTrade = useCallback(async (tradeDraft) => {
    let bookedTrade;

    try {
      bookedTrade = await submitTrade({
        ...tradeDraft,
        executionType: tradeDraft.executionType || 'MARKET',
      });
    } catch (error) {
      bookedTrade = {
        ...tradeDraft,
        id: tradeDraft.id || `FX-${Date.now()}`,
        status: 'BOOKED',
        bookingMode: 'local',
        executionType: tradeDraft.executionType || 'MARKET',
        bookedAt: new Date().toISOString(),
      };
    }

    setTrades((currentTrades) => mergeTrades([bookedTrade], currentTrades));
    return bookedTrade;
  }, []);

  const value = useMemo(
    () => ({
      userDetails,
      setUserDetails,
      login,
      startDemoSession,
      logout,
      trades,
      bookTrade,
    }),
    [bookTrade, login, logout, startDemoSession, trades, userDetails]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export { UserContext, UserProvider };
