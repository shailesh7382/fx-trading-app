// src/fxapp/FXTradingApp.js
import React from 'react';
import { Typography, Container, Box, Drawer, List, ListItem, ListItemText, Divider } from '@mui/material';

function FXTradingApp() {
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  const menuItems = [
    { text: 'FX Rate Grid', path: '/fxrategrid' },
    { text: 'FX Trade Booking', path: '/fxtradebooking' },
    { text: 'FX Trade Blotter', path: '/fxtradeblotter' }
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
        }}
      >
        <Box sx={{ overflow: 'auto' }}>
          <Typography variant="h6" sx={{ p: 2 }}>
            User Details
          </Typography>
          <Divider />
          <List>
            <ListItem>
              <ListItemText primary={`Username: ${userDetails.username}`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`Email: ${userDetails.email}`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`User Type: ${userDetails.userType}`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`Last Login: ${userDetails.lastLoginTimestamp}`} />
            </ListItem>
            <ListItem>
              <ListItemText primary={`Region: ${userDetails.region}`} />
            </ListItem>
          </List>
          <Divider />
          <List>
            {menuItems.map((item, index) => (
              <ListItem button key={index} onClick={() => window.location.href = item.path}>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Container maxWidth="md" sx={{ mt: 4, ml: 30 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Welcome to FX Trading App
        </Typography>
        {/* Add your FXTradingApp content here */}
      </Container>
    </Box>
  );
}

export default FXTradingApp;