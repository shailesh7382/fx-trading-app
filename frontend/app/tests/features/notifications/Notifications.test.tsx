import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test } from 'vitest';
import Notifications from '@/features/notifications/Notifications';
import type { AppNotification } from '@/shared/types';
import { TestWorkspaceShell, createWorkspaceContext } from '../../support/fixtures';

const notifications: AppNotification[] = [
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
  const workspaceData = createWorkspaceContext({
    notifications,
    notificationCount: 2,
    lastUpdated: '2026-05-26T08:00:00.000Z',
  });

  render(
    <MemoryRouter initialEntries={['/app/notifications']}>
      <Routes>
        <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return { refresh: workspaceData.refresh };
}

test('renders server notifications and summary metrics', async () => {
  renderNotificationsScreen();

  expect(await screen.findByText(/EURUSD trade booked/i)).toBeTruthy();
  expect(screen.getByText(/GBPUSD limit order working/i)).toBeTruthy();
  expect(screen.getByText(/EURUSD shows the widest live spread/i)).toBeTruthy();
  expect(screen.getByText(/2 unread/i)).toBeTruthy();
  expect(screen.getByText(/3 in feed/i)).toBeTruthy();
  expect(screen.queryByText('Trade, order, and market updates.')).toBeNull();
});

test('filters notifications by category', async () => {
  const user = userEvent.setup();
  renderNotificationsScreen();

  await screen.findByText(/EURUSD trade booked/i);

  await user.click(screen.getByRole('tab', { name: /order status/i }));

  expect(screen.queryByText(/EURUSD trade booked/i)).toBeNull();
  expect(screen.getByText(/GBPUSD limit order working/i)).toBeTruthy();
  expect(screen.queryByText(/widest live spread/i)).toBeNull();
});

test('narrows the feed to unread items', async () => {
  const user = userEvent.setup();
  renderNotificationsScreen();

  await screen.findByText(/EURUSD trade booked/i);

  await user.click(screen.getByRole('switch', { name: /unread only/i }));

  expect(screen.getByText(/EURUSD trade booked/i)).toBeTruthy();
  expect(screen.getByText(/GBPUSD limit order working/i)).toBeTruthy();
  expect(screen.queryByText(/widest live spread/i)).toBeNull();
});

test('groups the feed by day and offers a way back from an empty filter', async () => {
  const user = userEvent.setup();
  renderNotificationsScreen();

  await screen.findByText(/EURUSD trade booked/i);

  await user.click(screen.getByRole('tab', { name: /executions/i }));

  expect(screen.getByText(/nothing to show/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /clear filters/i }));

  expect(screen.getByText(/EURUSD trade booked/i)).toBeTruthy();
});
