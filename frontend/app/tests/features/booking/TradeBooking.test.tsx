import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import TradeBooking from '@/features/booking/TradeBooking';
import { UserContext } from '@/features/auth/UserProvider';
import {
  fallbackCustomers,
  fallbackRelationshipManagers,
  fallbackSales,
} from '@/shared/demo/demoData';
import { TestWorkspaceShell, createRate, createUserContext, createWorkspaceContext } from '../../support/fixtures';

vi.mock('@/shared/api/client', () => ({
  fetchLookup: vi.fn(),
  extractApiMessage: vi.fn((_error, fallback) => fallback),
}));

import { fetchLookup } from '@/shared/api/client';

const testRate = createRate();

function renderBookingScreen() {
  const workspaceData = createWorkspaceContext({ rates: [testRate] });
  const userContextValue = createUserContext({ bookTrade: vi.fn() });

  return render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/app/booking',
            state: { quote: testRate, direction: 'Buy', dealtCurrency: 'EUR', qty: 1000000 },
          },
        ]}
      >
        <Routes>
          <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
            <Route path="booking" element={<TradeBooking />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLookup).mockImplementation(async (path, fallback) => {
    if (path === '/customers') return fallbackCustomers;
    if (path === '/relationshipManagers') return fallbackRelationshipManagers;
    if (path === '/sales') return fallbackSales;
    return fallback;
  });
});

test('limits booking to the spot and outright-forward products supported by the simulator contract', async () => {
  renderBookingScreen();

  const spotFwdToggle = await screen.findByRole('button', { name: /fx spot\/fwd/i });
  expect(spotFwdToggle.getAttribute('aria-pressed')).toBe('true');

  expect(screen.queryByRole('button', { name: /fx swap/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /ndfs/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /bullion/i })).toBeNull();
});
