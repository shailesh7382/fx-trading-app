// src/App.js
import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import Login from './fxapp/Login';

function App() {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          FX Trading App
        </Typography>
        <Login />
      </Box>
    </Container>
  );
}

export default App;