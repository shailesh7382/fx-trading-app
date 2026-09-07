import type React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@/features/auth/UserProvider';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { userDetails } = useUser();
  const location = useLocation();

  if (!userDetails) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
