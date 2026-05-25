import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import UserContext from './UserContext';

function ProtectedRoute({ children }) {
  const { userDetails } = useContext(UserContext);
  const location = useLocation();

  if (!userDetails) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;


