import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXRateGrid from './FXRateGrid';
import FXTradeBlotter from './FXTradeBlotter';
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

  const bookedTrade = {
    id: 'TRD-1',
    ccyPair: 'EURUSD',
    tenor: 'SP',
    qty: 1000000,
    price: testRate.ask,
    direction: 'Buy',
    dealtCurrency: 'EUR',
    status: 'BOOKED',
    bookingMode: 'local',
    trader: 'demo.trader',
    bookedAt: '2026-05-26T08:01:00.000Z',
  };

  const userContextValue = {
    userDetails: { username: 'demo.trader' },
    trades: [bookedTrade],
    bookTrade: vi.fn().mockResolvedValue(bookedTrade),
  };

  return render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={['/app/rates']}>
        <Routes>
          <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
            <Route path="rates" element={<FXRateGrid />} />
            <Route path="booking" element={<FXTradeBooking />} />
            <Route path="blotter" element={<FXTradeBlotter />} />
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

test('lands on a bookable ticket straight from a rate-card click', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));

  expect(await screen.findByRole('heading', { name: /fx trade booking/i })).toBeInTheDocument();
  expect(await screen.findByRole('combobox', { name: /relationship manager/i })).toHaveTextContent(fallbackRelationshipManagers[0].name);
  expect(screen.getByRole('combobox', { name: /sales/i })).toHaveTextContent(fallbackSales[0].name);

  await user.click(screen.getByRole('button', { name: /book trade/i }));

  expect(screen.queryByText(/complete all booking fields/i)).not.toBeInTheDocument();
});

test('flips the ticket to a confirmation, then hands off to the blotter', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));
  await user.click(await screen.findByRole('button', { name: /book trade/i }));

  expect(await screen.findByRole('heading', { name: /trade confirmation/i })).toBeInTheDocument();
  expect(screen.getByText('Trade TRD-1 booked.')).toBeInTheDocument();
  expect(screen.getByText('Trade ID')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /book trade/i })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /view in blotter/i }));

  expect(await screen.findByRole('heading', { name: /trade blotter/i })).toBeInTheDocument();
  expect(screen.getByText('Just booked')).toBeInTheDocument();
});

test('flips back to a fresh ticket when booking another', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));
  await user.click(await screen.findByRole('button', { name: /book trade/i }));

  await user.click(await screen.findByRole('button', { name: /book another/i }));

  expect(await screen.findByRole('button', { name: /book trade/i })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: /trade confirmation/i })).not.toBeInTheDocument();
});
