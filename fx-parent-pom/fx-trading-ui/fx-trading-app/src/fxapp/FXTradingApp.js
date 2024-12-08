// src/fxapp/FXTradingApp.js
import React, { useState } from 'react';
import { Typography, Box, Drawer, List, ListItem, ListItemText, Divider, Avatar, ListItemIcon } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import BookIcon from '@mui/icons-material/Book';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PortfolioIcon from '@mui/icons-material/AccountBalance';
import FXRateGrid from './FXRateGrid';
import FXTradeBooking from './FXTradeBooking';
import FXTradeBlotter from './FXTradeBlotter';
import FXMarketAnalysis from './FXMarketAnalysis';
import FXPortfolio from './FXPortfolio';
import './FXApp.css'; // Import the CSS file

function FXTradingApp() {
  const [selectedComponent, setSelectedComponent] = useState(null);
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));

  const menuItems = [
    { text: 'FX Rate Grid', component: <FXRateGrid />, icon: <GridViewIcon /> },
    { text: 'FX Trade Booking', component: <FXTradeBooking />, icon: <BookIcon /> },
    { text: 'FX Trade Blotter', component: <FXTradeBlotter />, icon: <ListAltIcon /> },
    { text: 'FX Market Analysis', component: <FXMarketAnalysis />, icon: <AssessmentIcon /> },
    { text: 'FX Portfolio', component: <FXPortfolio />, icon: <PortfolioIcon /> }
  ];

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box className="container">
      <Drawer
        variant="permanent"
        sx={{
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 260, boxSizing: 'border-box' },
        }}
      >
        <Box sx={{ overflow: 'auto', textAlign: 'center', p: 2 }}>
          <Avatar sx={{ width: 56, height: 56, margin: '0 auto' }}>
            {userDetails ? userDetails.username.charAt(0).toUpperCase() : 'G'}
          </Avatar>
          <Typography variant="h6" sx={{ mt: 2 }}>
            {userDetails ? userDetails.username : 'Guest'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {userDetails ? userDetails.email : 'guest@example.com'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            User Type: {userDetails ? userDetails.userType : 'N/A'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Last Login: {userDetails ? formatTimestamp(userDetails.lastLoginTimestamp) : 'N/A'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Region: {userDetails ? userDetails.region : 'N/A'}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <List>
            {menuItems.map((item, index) => (
              <ListItem button key={index} onClick={() => setSelectedComponent(item.component)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box sx={{ flexGrow: 1, padding: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
        {selectedComponent || (
          <Typography variant="h4" component="h2" gutterBottom>
            Welcome to FX Trading App
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default FXTradingApp;