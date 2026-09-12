import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import RateGrid from '@/features/rates/RateGrid';
import TradeBlotter from '@/features/blotter/TradeBlotter';
import TradeBooking from '@/features/booking/TradeBooking';
import { UserContext } from '@/features/auth/UserProvider';
import { calculateSettlementDate } from '@/shared/utils/formatters';
import {
  fallbackCustomers,
  fallbackRelationshipManagers,
  fallbackSales,
} from '@/shared/demo/demoData';
import type { Trade } from '@/shared/types';
import { TestWorkspaceShell, createRate, createUserContext, createWorkspaceContext } from '../../support/fixtures';

vi.mock('@/shared/api/client', () => ({
  fetchFxGrid: vi.fn(),
  fetchLookup: vi.fn(),
}));

import { fetchFxGrid, fetchLookup } from '@/shared/api/client';

const testRate = createRate({
  quoteId: 'quote-private-123',
  bidCoverPrice: 9.87654,
  askCoverPrice: 9.87655,
});

function renderBookingFlow() {
  const workspaceData = createWorkspaceContext({
    rates: [testRate],
    lastUpdated: testRate.updatedAt,
    isDemo: true,
  });

  const bookedTrade: Trade = {
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
    quoteId: 'quote-private-123',
    coverPrice: 9.87655,
  };

  const userContextValue = createUserContext({
    trades: [bookedTrade],
    bookTrade: vi.fn().mockResolvedValue(bookedTrade),
  });

  return render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={['/app/rates']}>
        <Routes>
          <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
            <Route path="rates" element={<RateGrid />} />
            <Route path="booking" element={<TradeBooking />} />
            <Route path="blotter" element={<TradeBlotter />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchFxGrid).mockResolvedValue([testRate]);
  vi.mocked(fetchLookup).mockImplementation(async (_path, fallback) => fallback);
});

test.each(['Buy', 'Sell'])(
  'passes selected deal currency and value date into booking when %s is clicked',
  async (direction) => {
    const user = userEvent.setup();
    renderBookingFlow();

    await screen.findByRole('button', { name: direction });

    await user.click(screen.getByRole('button', { name: /toggle dealt currency to usd/i }));
    const expectedValueDate = calculateSettlementDate(new Date().toISOString(), testRate.tenor);

    await user.click(screen.getByRole('button', { name: direction }));

    expect((await screen.findByRole('combobox', { name: /direction/i })).textContent).toContain(direction);
    expect(screen.getByRole('combobox', { name: /dealt currency/i }).textContent).toContain('USD');
    expect(screen.queryByText('FX trade booking')).toBeNull();
    expect(screen.queryByText('Product')).toBeNull();
    expect((screen.getByLabelText(/settlement date/i) as HTMLInputElement).value).toBe(
      expectedValueDate
    );
    expect(fetchLookup).toHaveBeenCalledWith('/customers', fallbackCustomers);
    expect(fetchLookup).toHaveBeenCalledWith('/relationshipManagers', fallbackRelationshipManagers);
    expect(fetchLookup).toHaveBeenCalledWith('/sales', fallbackSales);
  }
);

test('does not expose internal pricing details, date chips, or points on spot rate cards', async () => {
  renderBookingFlow();

  await screen.findByRole('button', { name: 'Buy' });

  expect(screen.queryByText(/quote-private-123/i)).toBeNull();
  expect(screen.queryByText(/cover 9\.8765/i)).toBeNull();
  expect(screen.queryByText(/^Spot /i)).toBeNull();
  expect(screen.queryByText(/^Value /i)).toBeNull();
  expect(screen.queryByText(/^Pts /i)).toBeNull();
});

test('passes an edited rate-card quantity into booking', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  const quantityInput = await screen.findByLabelText(/eurusd quantity/i);

  fireEvent.change(quantityInput, { target: { value: '1000000' } });
  fireEvent.blur(quantityInput);

  expect((quantityInput as HTMLInputElement).value).toBe('1,000,000');

  await user.click(screen.getByRole('button', { name: 'Buy' }));

  expect((await screen.findByLabelText(/quantity/i) as HTMLInputElement).valueAsNumber).toBe(1000000);
});

test('lands on a bookable ticket straight from a rate-card click', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));

  const rmCombobox = await screen.findByRole('combobox', { name: /relationship manager/i });
  expect(rmCombobox.textContent).toContain(fallbackRelationshipManagers[0].name);
  expect(screen.getByRole('combobox', { name: /sales/i }).textContent).toContain(
    fallbackSales[0].name
  );

  await user.click(screen.getByRole('button', { name: /book trade/i }));

  expect(screen.queryByText(/complete all booking fields/i)).toBeNull();
});

test('flips the ticket to a confirmation, then hands off to the blotter', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));
  await user.click(await screen.findByRole('button', { name: /book trade/i }));

  expect(await screen.findByRole('heading', { name: /trade confirmation/i })).toBeTruthy();
  expect(screen.getByText('Trade TRD-1 booked.')).toBeTruthy();
  expect(screen.getByText('Trade ID')).toBeTruthy();
  expect(screen.queryByText('Quote ID')).toBeNull();
  expect(screen.queryByText('Cover price')).toBeNull();
  expect(screen.queryByText('quote-private-123')).toBeNull();
  expect(screen.queryByRole('button', { name: /book trade/i })).toBeNull();

  await user.click(screen.getByRole('button', { name: /view in blotter/i }));

  expect(await screen.findByRole('button', { name: /export blotter/i })).toBeTruthy();
  expect(screen.getByText('Just booked')).toBeTruthy();
  expect(screen.queryByText('Trade blotter')).toBeNull();
  expect(screen.queryByText('Booked trades and execution history.')).toBeNull();
  expect(screen.queryByText('Quote ID')).toBeNull();
  expect(screen.queryByText(/Cover \/ swap/i)).toBeNull();
  expect(screen.queryByText('quote-private-123')).toBeNull();
});

test('flips back to a fresh ticket when booking another', async () => {
  const user = userEvent.setup();
  renderBookingFlow();

  await user.click(await screen.findByRole('button', { name: 'Buy' }));
  await user.click(await screen.findByRole('button', { name: /book trade/i }));

  await user.click(await screen.findByRole('button', { name: /book another/i }));

  const bookTradeButton = (await screen.findByRole('button', {
    name: /book trade/i,
  })) as HTMLButtonElement;
  expect(bookTradeButton.disabled).toBe(false);
  expect(screen.queryByRole('heading', { name: /trade confirmation/i })).toBeNull();
});
