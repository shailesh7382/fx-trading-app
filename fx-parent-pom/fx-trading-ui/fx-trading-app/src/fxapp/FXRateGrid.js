// src/fxapp/FXRateGrid.js
import React from 'react';
import { Typography, Container, Box } from '@mui/material';

function FXRateGrid() {
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        FX Rate Grid
      </Typography>
      <Typography variant="body1">
        Welcome, {userDetails ? userDetails.username : 'Guest'}. Here you can view the FX rates.
      </Typography>
      {/* Add your FXRateGrid content here */}
    </Container>
  );
}

export default FXRateGrid;