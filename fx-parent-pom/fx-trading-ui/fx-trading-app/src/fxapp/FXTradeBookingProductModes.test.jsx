import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXTradeBooking from './FXTradeBooking';
import UserContext from './UserContext';
import { fallbackCustomers, fallbackRelationshipManagers, fallbackSales } from '../data/mockData';

vi.mock('../api/client', () => ({
  fetchLookup: vi.fn(),
}));

import { fetchLookup } from '../api/client';

function TestWorkspaceShell({ workspaceData }) {
  return <Outlet context={workspaceData} />;
}

const testRate = {
  ccyPair: 'EURUSD',
  tenor: 'SP',
  qty: 5000000,
  bid: 1.08321,
  ask: 1.08339,
  source: 'STREAM',
  status: 'LIVE',
  updatedAt: '2026-05-26T08:00:00.000Z',
};

function renderBookingScreen() {
  const workspaceData = {
    rates: [testRate],
  };

  const userContextValue = {
    userDetails: { username: 'demo.trader' },
    bookTrade: vi.fn(),
  };

  return render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={[{ pathname: '/app/booking', state: { quote: testRate, direction: 'Buy', dealtCurrency: 'EUR', qty: 1000000 } }]}>
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
  fetchLookup.mockImplementation(async (path, fallback) => {
    if (path === '/customers') return fallbackCustomers;
    if (path === '/relationshipManagers') return fallbackRelationshipManagers;
    if (path === '/sales') return fallbackSales;
    return fallback;
  });
});

test('defaults rate-launched booking to FX Spot/Fwd and switches product attributes by mode', async () => {
  const user = userEvent.setup();
  renderBookingScreen();

  expect(await screen.findByRole('button', { name: /fx spot\/fwd/i })).toHaveAttribute('aria-pressed', 'true');

  await user.click(screen.getByRole('button', { name: /fx swap/i }));
  expect(screen.getByLabelText(/far tenor/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/far leg rate/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/far settlement/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /ndfs/i }));
  expect(screen.getByLabelText(/fixing date/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/fixing source/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/nds currency/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /bullion/i }));
  expect(screen.getByLabelText(/^metal$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/metal pair/i)).toHaveValue('XAUUSD');
  expect(screen.getByLabelText(/bullion settlement/i)).toBeInTheDocument();
});


