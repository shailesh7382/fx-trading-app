import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXRateGrid from './FXRateGrid';
import FXTradeBooking from './FXTradeBooking';
import UserContext from './UserContext';
import { calculateSettlementDate } from '../utils/formatters';
import { fallbackCustomers, fallbackRelationshipManagers, fallbackSales } from '../data/mockData';

vi.mock('../api/client', () => ({
  fetchFxGrid: vi.fn(),
  fetchLookup: vi.fn(),
}));

import { fetchFxGrid, fetchLookup } from '../api/client';

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

function renderBookingFlow() {
  const workspaceData = {
    rates: [testRate],
    error: '',
    isLoading: false,
    lastUpdated: testRate.updatedAt,
    isDemo: true,
  };

  const userContextValue = {
    userDetails: { username: 'demo.trader' },
    bookTrade: vi.fn(),
  };

  return render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={['/app/rates']}>
        <Routes>
          <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
            <Route path="rates" element={<FXRateGrid />} />
            <Route path="booking" element={<FXTradeBooking />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchFxGrid.mockResolvedValue([testRate]);
  fetchLookup.mockImplementation(async (_path, fallback) => fallback);
});

test.each(['Buy', 'Sell'])('passes selected deal currency and value date into booking when %s is clicked', async (direction) => {
  const user = userEvent.setup();
  renderBookingFlow();

  await screen.findByRole('button', { name: direction });

  await user.click(screen.getByRole('button', { name: /toggle dealt currency to usd/i }));
  const expectedValueDate = calculateSettlementDate(new Date().toISOString(), testRate.tenor);

  expect(screen.getByText(expectedValueDate)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: direction }));

  expect(await screen.findByRole('heading', { name: /fx trade booking/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /direction/i })).toHaveTextContent(direction);
  expect(screen.getByRole('combobox', { name: /dealt currency/i })).toHaveTextContent('USD');
  expect(screen.getByLabelText(/settlement date/i)).toHaveValue(expectedValueDate);
  expect(fetchLookup).toHaveBeenCalledWith('/customers', fallbackCustomers);
  expect(fetchLookup).toHaveBeenCalledWith('/relationshipManagers', fallbackRelationshipManagers);
  expect(fetchLookup).toHaveBeenCalledWith('/sales', fallbackSales);
});

test('passes an edited rate-card quantity into booking', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  const quantityInput = await screen.findByLabelText(/eurusd quantity/i);

  fireEvent.change(quantityInput, { target: { value: '1000000' } });
  fireEvent.blur(quantityInput);

  expect(quantityInput).toHaveValue('1,000,000');

  await user.click(screen.getByRole('button', { name: 'Buy' }));

  expect(await screen.findByRole('heading', { name: /fx trade booking/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/quantity/i)).toHaveValue(1000000);
});

