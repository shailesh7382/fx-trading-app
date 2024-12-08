// src/fxapp/FXPortfolio.js
import React, { useContext } from 'react';
import { Typography, Container, Box } from '@mui/material';
import UserContext from './UserContext';

function FXPortfolio() {
    const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Portfolio
      </Typography>
      <Typography variant="body1">
         Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can view your FX portfolio.
      </Typography>
      {/* Add your FXPortfolio content here */}
    </Container>
  );
}

export default FXPortfolio;