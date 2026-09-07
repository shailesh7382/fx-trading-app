import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchTrades, loginUser, submitTrade } from '../api/client';
import { createDemoUser, sampleTrades } from '../data/mockData';
import type { AuthenticatedUser, Credentials, Trade, TradeDraft } from '../types';

const USER_STORAGE_KEY = 'fx-trading-app:user';
const TRADE_STORAGE_KEY = 'fx-trading-app:trades';

export interface UserContextValue {
  userDetails: AuthenticatedUser | null;
  setUserDetails: React.Dispatch<React.SetStateAction<AuthenticatedUser | null>>;
  login: (credentials: Credentials) => Promise<AuthenticatedUser>;
  startDemoSession: (username?: string) => AuthenticatedUser;
  logout: () => void;
  trades: Trade[];
  bookTrade: (tradeDraft: TradeDraft) => Promise<Trade>;
}

const UserContext = createContext<UserContextValue | null>(null);

/** Reads the session/trade caches, falling back when the entry is absent or corrupt. */
function readJsonStorage<T>(storage: Storage, key: string, fallbackValue: T): T {
  try {
    const storedValue = storage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (left, right) => new Date(right.bookedAt || 0).getTime() - new Date(left.bookedAt || 0).getTime()
  );
}

function mergeTrades(serverTrades: Trade[] = [], currentTrades: Trade[] = []): Trade[] {
  const tradesById = new Map<string, Trade>();

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

function UserProvider({ children }: { children: React.ReactNode }) {
  const [userDetails, setUserDetails] = useState<AuthenticatedUser | null>(() =>
    readJsonStorage<AuthenticatedUser | null>(sessionStorage, USER_STORAGE_KEY, null)
  );
  const [trades, setTrades] = useState<Trade[]>(() =>
    readJsonStorage<Trade[]>(localStorage, TRADE_STORAGE_KEY, sampleTrades)
  );

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
    } catch {
      // Keep the locally stored blotter when the API is unavailable.
    }
  }, []);

  useEffect(() => {
    syncTrades();

    const intervalId = window.setInterval(syncTrades, 5000);
    return () => window.clearInterval(intervalId);
  }, [syncTrades]);

  const login = useCallback(async (credentials: Credentials) => {
    const authenticatedUser = await loginUser(credentials);
    setUserDetails(authenticatedUser);
    return authenticatedUser;
  }, []);

  const startDemoSession = useCallback((username?: string) => {
    const demoUser = createDemoUser(username || 'demo.trader');
    setUserDetails(demoUser);
    return demoUser;
  }, []);

  const logout = useCallback(() => {
    setUserDetails(null);
  }, []);

  const bookTrade = useCallback(async (tradeDraft: TradeDraft) => {
    let bookedTrade: Trade;

    try {
      bookedTrade = await submitTrade({
        ...tradeDraft,
        executionType: tradeDraft.executionType || 'MARKET',
      });
    } catch {
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

  const value = useMemo<UserContextValue>(
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

/** Typed accessor for the session context; throws outside a {@link UserProvider}. */
function useUser(): UserContextValue {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used inside a UserProvider.');
  }

  return context;
}

export { UserContext, UserProvider, useUser };
