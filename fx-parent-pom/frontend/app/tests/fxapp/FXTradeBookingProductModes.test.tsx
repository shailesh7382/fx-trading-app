import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXTradeBooking from '../../src/fxapp/FXTradeBooking';
import { UserContext } from '../../src/fxapp/UserProvider';
import {
  fallbackCustomers,
  fallbackRelationshipManagers,
  fallbackSales,
} from '../../src/data/mockData';
import { TestWorkspaceShell, createRate, createUserContext, createWorkspaceContext } from '../support/fixtures';

vi.mock('../../src/api/client', () => ({
  fetchLookup: vi.fn(),
}));

import { fetchLookup } from '../../src/api/client';

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
            <Route path="booking" element={<FXTradeBooking />} />
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

test('defaults rate-launched booking to FX Spot/Fwd and switches product attributes by mode', async () => {
  const user = userEvent.setup();
  renderBookingScreen();

  const spotFwdToggle = await screen.findByRole('button', { name: /fx spot\/fwd/i });
  expect(spotFwdToggle.getAttribute('aria-pressed')).toBe('true');

  await user.click(screen.getByRole('button', { name: /fx swap/i }));
  expect(screen.getByLabelText(/far tenor/i)).toBeTruthy();
  expect(screen.getByLabelText(/far leg rate/i)).toBeTruthy();
  expect(screen.getByLabelText(/far settlement/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /ndfs/i }));
  expect(screen.getByLabelText(/fixing date/i)).toBeTruthy();
  expect(screen.getByLabelText(/fixing source/i)).toBeTruthy();
  expect(screen.getByLabelText(/nds currency/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /bullion/i }));
  expect(screen.getByLabelText(/^metal$/i)).toBeTruthy();
  expect((screen.getByLabelText(/metal pair/i) as HTMLInputElement).value).toBe('XAUUSD');
  expect(screen.getByLabelText(/bullion settlement/i)).toBeTruthy();
});
