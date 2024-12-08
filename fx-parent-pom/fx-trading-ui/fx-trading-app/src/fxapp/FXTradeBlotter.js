// src/fxapp/FXTradeBlotter.js
import React, { useContext } from 'react';
import { Typography, Container, Box } from '@mui/material';
import UserContext from './UserContext';

function FXTradeBlotter() {
    const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Trade Blotter
      </Typography>
      <Typography variant="body1">
         Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can view your FX trade blotter.
      </Typography>
      {/* Add your FXTradeBlotter content here */}
    </Container>
  );
}

export default FXTradeBlotter;