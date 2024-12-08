// src/fxapp/FXMarketAnalysis.js
import React, { useContext } from 'react';
import { Typography, Container, Box } from '@mui/material';
import UserContext from './UserContext';

function FXMarketAnalysis() {
    const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Market Analysis
      </Typography>
      <Typography variant="body1">
         Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can analyze the FX market.
      </Typography>
      {/* Add your FXMarketAnalysis content here */}
    </Container>
  );
}

export default FXMarketAnalysis;