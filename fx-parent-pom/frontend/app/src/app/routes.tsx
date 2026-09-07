import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MarketAnalysis from '@/features/analysis/MarketAnalysis';
import { useUser } from '@/features/auth/UserProvider';
import Login from '@/features/auth/Login';
import ProtectedRoute from '@/features/auth/ProtectedRoute';
import TradeBlotter from '@/features/blotter/TradeBlotter';
import TradeBooking from '@/features/booking/TradeBooking';
import LimitOrders from '@/features/limit-orders/LimitOrders';
import Notifications from '@/features/notifications/Notifications';
import RateGrid from '@/features/rates/RateGrid';
import WorkspaceLayout from '@/features/workspace/WorkspaceLayout';

/**
 * The route table. Everything under `/app` renders inside `WorkspaceLayout`,
 * which owns the navigation chrome and publishes workspace data to the outlet.
 */
export default function AppRoutes() {
  const { userDetails } = useUser();

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
