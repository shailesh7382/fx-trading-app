// src/fxapp/FXTradingApp.js
import React, { useState } from 'react';
import { Typography, Box, List, ListItem, ListItemText, Divider, Avatar, ListItemIcon, CssBaseline, AppBar, Toolbar, Drawer, useMediaQuery, Link, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GridViewIcon from '@mui/icons-material/GridView';
import BookIcon from '@mui/icons-material/Book';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PortfolioIcon from '@mui/icons-material/AccountBalance';
import EmailIcon from '@mui/icons-material/Email';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import PersonIcon from '@mui/icons-material/Person';
import FXRateGrid from './FXRateGrid';
import FXTradeBooking from './FXTradeBooking';
import FXTradeBlotter from './FXTradeBlotter';
import FXMarketAnalysis from './FXMarketAnalysis';
import FXPortfolio from './FXPortfolio';
import './FXApp.css'; // Import the CSS file

const drawerWidth = 240;

function FXTradingApp() {
  const [selectedComponent, setSelectedComponent] = useState(null);
  const userDetails = JSON.parse(sessionStorage.getItem('userDetails'));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const menuItems = [
    { text: 'FX Rate Grid', component: <FXRateGrid setSelectedComponent={setSelectedComponent} />, icon: <GridViewIcon /> },
    { text: 'FX Trade Booking', component: <FXTradeBooking />, icon: <BookIcon /> },
    { text: 'FX Trade Blotter', component: <FXTradeBlotter />, icon: <ListAltIcon /> },
    { text: 'FX Market Analysis', component: <FXMarketAnalysis />, icon: <AssessmentIcon /> },
    { text: 'FX Portfolio', component: <FXPortfolio />, icon: <PortfolioIcon /> }
  ];

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getRegionIcon = (region) => {
    switch (region) {
      case 'SG':
        return <img src="https://upload.wikimedia.org/wikipedia/commons/4/48/Flag_of_Singapore.svg" alt="SG" style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 4, border: '1px solid #ccc', borderRadius: '2px' }} />;
      default:
        return <FlagIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />;
    }
  };  

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            FX Trading App
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 1 }}>
          <Avatar sx={{ width: isMobile ? 24 : 48, height: isMobile ? 24 : 48, margin: '0 auto' }}>
            {userDetails ? userDetails.username.charAt(0).toUpperCase() : 'G'}
          </Avatar>
          {!isMobile && (
            <>
              <Box sx={{ textAlign: 'left', mt: 1 }}>
                <Typography variant="h6" sx={{ textAlign: 'center' }}>
                  {userDetails ? userDetails.username : 'Guest'}
                </Typography>
                <Tooltip title="Email Address">
                  <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Link href={`mailto:${userDetails ? userDetails.email : 'guest@example.com'}`} color="inherit">
                      <EmailIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                      {userDetails ? userDetails.email : 'guest@example.com'}
                    </Link>
                  </Typography>
                </Tooltip>
                <Tooltip title="User Type">
                  <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <PersonIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {userDetails ? userDetails.userType : 'N/A'}
                  </Typography>
                </Tooltip>
                <Tooltip title="Last Login Time">
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {userDetails ? formatTimestamp(userDetails.lastLoginTimestamp) : 'N/A'}
                  </Typography>
                </Tooltip>
                <Tooltip title="Region">
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    {getRegionIcon(userDetails ? userDetails.region : 'N/A')}
                    {userDetails ? userDetails.region : 'N/A'}
                  </Typography>
                </Tooltip>
              </Box>
              <Divider sx={{ my: 1 }} />
            </>
          )}
          <List>
            {menuItems.map((item, index) => (
              <ListItem button key={index} onClick={() => setSelectedComponent(item.component)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                {!isMobile && <ListItemText primary={item.text} />}
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${drawerWidth}px)`, height: '100%' }}
      >
        <Toolbar />
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