// src/fxapp/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container, Typography, Box } from '@mui/material';
import Login from './fxapp/Login';
import FXTradingApp from './fxapp/FXTradingApp';

function App() {
    const [userDetails, setUserDetails] = useState(null);

    return (
        <Router>
            <Container maxWidth="md">
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h3" component="h1" gutterBottom>
                        FX Trading App
                    </Typography>
                    <Routes>
                        <Route path="/" element={<Login setUserDetails={setUserDetails} />} />
                        <Route path="/fxtradingapp" element={<FXTradingApp userDetails={userDetails} />} />
                    </Routes>
                </Box>
            </Container>
        </Router>
    );
}

export default App;