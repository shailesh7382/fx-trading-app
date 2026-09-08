import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { vi } from 'vitest';
import type { UserContextValue } from '@/features/auth/UserProvider';
import type { WorkspaceContextValue } from '@/features/workspace/useWorkspaceData';
import type { NormalizedRate } from '@/shared/types';

/**
 * Test doubles for the two contexts the screens read from. Both factories return a
 * complete value so the screens see the same shape they get in the running app,
 * and each test overrides only the fields it cares about.
 */

export function createRate(overrides: Partial<NormalizedRate> = {}): NormalizedRate {
  const bid = overrides.bid ?? 1.08321;
  const ask = overrides.ask ?? 1.08339;

  return {
    ccyPair: 'EURUSD',
    tenor: 'SP',
    qty: 5000000,
    bid,
    ask,
    source: 'SIMULATOR',
    status: 'ACTIVE',
    updatedAt: '2026-05-26T08:00:00.000Z',
    mid: Number(((bid + ask) / 2).toFixed(5)),
    spreadPips: Number(((ask - bid) * 10000).toFixed(1)),
    bidDelta: 0,
    askDelta: 0,
    ...overrides,
  };
}

export function createWorkspaceContext(
  overrides: Partial<WorkspaceContextValue> = {}
): WorkspaceContextValue {
  return {
    rates: [],
    isLoading: false,
    isDemo: false,
    error: '',
    limitOrders: [],
    notifications: [],
    notificationCount: 0,
    lastUpdated: '2026-05-26T08:00:00.000Z',
    manualRefreshToken: 0,
    refresh: vi.fn().mockResolvedValue(undefined),
    requestRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function createUserContext(overrides: Partial<UserContextValue> = {}): UserContextValue {
  return {
    userDetails: { username: 'demo.trader' },
    setUserDetails: vi.fn(),
    login: vi.fn(),
    startDemoSession: vi.fn(),
    logout: vi.fn(),
    trades: [],
    bookTrade: vi.fn(),
    ...overrides,
  };
}

/** Stands in for `WorkspaceLayout`, publishing workspace data down the router outlet. */
export function TestWorkspaceShell({
  workspaceData,
}: {
  workspaceData: WorkspaceContextValue;
}): ReactNode {
  return <Outlet context={workspaceData} />;
}
