import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import FXNotifications from './FXNotifications';

function TestWorkspaceShell({ workspaceData }) {
  return <Outlet context={workspaceData} />;
}

const notifications = [
  {
    id: 'TRADE-FX-1',
    title: 'EURUSD trade booked',
    message: 'Buy 1,000,000 EUR at 1.08321 · Trader demo.trader',
    category: 'TRADE',
    severity: 'info',
    source: 'Trade capture',
    relatedId: 'FX-1',
    createdAt: '2026-05-26T08:00:00.000Z',
    unread: true,
  },
  {
    id: 'ORDER-LO-1-ACTIVE',
    title: 'GBPUSD limit order working',
    message: 'Sell 2,000,000 GBP target 1.27410 · Until cancelled',
    category: 'ORDER_STATUS',
    severity: 'primary',
    source: 'Order management',
    relatedId: 'LO-1',
    createdAt: '2026-05-26T07:58:00.000Z',
    unread: true,
  },
  {
    id: 'MARKET-SPREAD-EURUSD-SP',
    title: 'EURUSD shows the widest live spread',
    message: 'SP spread is 1.8 pips across 5,000,000 with STREAM pricing.',
    category: 'MARKET_COMMENTARY',
    severity: 'warning',
    source: 'Market commentary',
    relatedId: 'EURUSD-SP',
    createdAt: '2026-05-26T07:59:00.000Z',
    unread: false,
  },
];

function renderNotificationsScreen() {
  const refresh = vi.fn().mockResolvedValue(undefined);

  render(
    <MemoryRouter initialEntries={['/app/notifications']}>
      <Routes>
        <Route
          path="/app"
          element={<TestWorkspaceShell workspaceData={{ notifications, notificationCount: 2, isLoading: false, error: '', lastUpdated: '2026-05-26T08:00:00.000Z', refresh }} />}
        >
          <Route path="notifications" element={<FXNotifications />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return { refresh };
}

test('renders server notifications and summary metrics', async () => {
  renderNotificationsScreen();

  expect(await screen.findByRole('heading', { name: /notifications/i })).toBeInTheDocument();
  expect(screen.getByText(/EURUSD trade booked/i)).toBeInTheDocument();
  expect(screen.getByText(/GBPUSD limit order working/i)).toBeInTheDocument();
  expect(screen.getByText(/EURUSD shows the widest live spread/i)).toBeInTheDocument();
  expect(screen.getByText(/2 in feed/i)).toBeInTheDocument();
});

test('filters notifications by category', async () => {
  const user = userEvent.setup();
  renderNotificationsScreen();

  await screen.findByText(/EURUSD trade booked/i);

  await user.click(screen.getByLabelText(/notification category/i));
  await user.click(screen.getByRole('option', { name: /order status/i }));

  expect(screen.queryByText(/EURUSD trade booked/i)).not.toBeInTheDocument();
  expect(screen.getByText(/GBPUSD limit order working/i)).toBeInTheDocument();
  expect(screen.queryByText(/widest live spread/i)).not.toBeInTheDocument();
});

