import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useUser } from '@/features/auth/UserProvider';
import Login from '@/features/auth/Login';
import ProtectedRoute from '@/features/auth/ProtectedRoute';
import WorkspaceLayout from '@/features/workspace/WorkspaceLayout';

const MarketAnalysis = lazy(() => import('@/features/analysis/MarketAnalysis'));
const TradeBlotter = lazy(() => import('@/features/blotter/TradeBlotter'));
const TradeBooking = lazy(() => import('@/features/booking/TradeBooking'));
const LimitOrders = lazy(() => import('@/features/limit-orders/LimitOrders'));
const Notifications = lazy(() => import('@/features/notifications/Notifications'));
const RateGrid = lazy(() => import('@/features/rates/RateGrid'));

/**
 * The route table. Everything under `/app` renders inside `WorkspaceLayout`,
 * which owns the navigation chrome and publishes workspace data to the outlet.
 */
export default function AppRoutes() {
  const { userDetails } = useUser();

  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status">Loading workspace…</div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <WorkspaceLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="rates" replace />} />
            <Route path="rates" element={<RateGrid />} />
            <Route path="limit-orders" element={<LimitOrders />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="booking" element={<TradeBooking />} />
            <Route path="blotter" element={<TradeBlotter />} />
            <Route path="analysis" element={<MarketAnalysis />} />
          </Route>
          <Route path="*" element={<Navigate to={userDetails ? '/app' : '/'} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
