import React, { useContext } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import Login from './fxapp/Login';
import FXTradingApp from './fxapp/FXTradingApp';
import FXRateGrid from './fxapp/FXRateGrid';
import FXLimitOrders from './fxapp/FXLimitOrders';
import FXTradeBooking from './fxapp/FXTradeBooking';
import FXTradeBlotter from './fxapp/FXTradeBlotter';
import FXMarketAnalysis from './fxapp/FXMarketAnalysis';
import FXPortfolio from './fxapp/FXPortfolio';
import ProtectedRoute from './fxapp/ProtectedRoute';
import UserContext from './fxapp/UserContext';
import { UserProvider } from './fxapp/UserProvider';
import appTheme from './theme';

function AppRoutes() {
  const { userDetails } = useContext(UserContext);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <FXTradingApp />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="rates" replace />} />
          <Route path="rates" element={<FXRateGrid />} />
          <Route path="limit-orders" element={<FXLimitOrders />} />
          <Route path="booking" element={<FXTradeBooking />} />
          <Route path="blotter" element={<FXTradeBlotter />} />
          <Route path="analysis" element={<FXMarketAnalysis />} />
          <Route path="portfolio" element={<FXPortfolio />} />
        </Route>
        <Route path="*" element={<Navigate to={userDetails ? '/app' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <UserProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppRoutes />
      </ThemeProvider>
    </UserProvider>
  );
}

export default App;
