// src/fxapp/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container, Typography, Box } from '@mui/material';
import Login from './fxapp/Login';
import FXTradingApp from './fxapp/FXTradingApp';
import FXRateGrid from './fxapp/FXRateGrid';
import FXTradeBooking from './fxapp/FXTradeBooking';
import FXTradeBlotter from './fxapp/FXTradeBlotter';
import FXMarketAnalysis from './fxapp/FXMarketAnalysis';
import FXPortfolio from './fxapp/FXPortfolio';
import UserContext from './fxapp/UserContext';

function App() {
    const [userDetails, setUserDetails] = useState(null);

    return (
        <UserContext.Provider value={userDetails}>
            <Router>
                <Container maxWidth="md">
                    <Box sx={{ mt: 4 }}>
                        {/*<Typography variant="h3" component="h1" gutterBottom>*/}
                        {/*    FX Trading App*/}
                        {/*</Typography>*/}
                        <Routes>
                            <Route path="/" element={<Login setUserDetails={setUserDetails} />} />
                            <Route path="/fxtradingapp" element={<FXTradingApp />}>
                                {/*<Route path="fxrategrid" element={<FXRateGrid />} />*/}
                                {/*<Route path="fxtradebooking" element={<FXTradeBooking />} />*/}
                                {/*<Route path="fxtradeblotter" element={<FXTradeBlotter />} />*/}
                                {/*<Route path="fxmarketanalysis" element={<FXMarketAnalysis />} />*/}
                                {/*<Route path="fxportfolio" element={<FXPortfolio />} />*/}
                            </Route>
                        </Routes>
                    </Box>
                </Container>
            </Router>
        </UserContext.Provider>
    );
}

export default App;