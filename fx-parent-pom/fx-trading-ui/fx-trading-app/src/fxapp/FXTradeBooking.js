// src/fxapp/FXTradeBooking.js
import React, { useContext } from 'react';
import { Typography, Container, Box } from '@mui/material';
import UserContext from './UserContext';

function FXTradeBooking() {
    const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Trade Booking
      </Typography>
      <Typography variant="body1">
         Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can book your FX trades.
      </Typography>
      {/* Add your FXTradeBooking content here */}
    </Container>
  );
}

export default FXTradeBooking;