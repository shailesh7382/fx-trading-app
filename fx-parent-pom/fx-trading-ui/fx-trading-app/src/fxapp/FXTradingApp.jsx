import React, { useContext, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AddCardRoundedIcon from '@mui/icons-material/AddCardRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import UserContext from './UserContext';
import useWorkspaceData from './useWorkspaceData';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';
import ecxIcon from '../assets/eCX-icon.svg';

const drawerWidth = 280;

const navigationItems = [
  { label: 'Rates', path: '/app/rates', icon: <CandlestickChartRoundedIcon /> },
  { label: 'Limit orders', path: '/app/limit-orders', icon: <PendingActionsRoundedIcon /> },
  { label: 'Booking', path: '/app/booking', icon: <AddCardRoundedIcon /> },
  { label: 'Blotter', path: '/app/blotter', icon: <ReceiptLongRoundedIcon /> },
  { label: 'Analysis', path: '/app/analysis', icon: <InsightsRoundedIcon /> },
  { label: 'Portfolio', path: '/app/portfolio', icon: <AccountBalanceWalletRoundedIcon /> },
];

const pageTitles = {
  '/app/rates': {
    title: 'Rates',
    subtitle: 'Review current prices, spreads, and available size.',
  },
  '/app/limit-orders': {
    title: 'Limit orders',
    subtitle: 'Review active and historical spot limit orders across the desk.',
  },
  '/app/booking': {
    title: 'Booking',
    subtitle: 'Capture trade details, coverage assignments, and settlement terms.',
  },
  '/app/blotter': {
    title: 'Trade blotter',
    subtitle: 'Review booked trades, status, and client activity.',
  },
  '/app/analysis': {
    title: 'Market analysis',
    subtitle: 'Monitor price moves, spread conditions, and liquidity.',
  },
  '/app/portfolio': {
    title: 'Portfolio',
    subtitle: 'Summarize exposures and client concentration from booked trades.',
  },
};

function FXTradingApp() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { userDetails, logout, trades } = useContext(UserContext);
  const workspaceData = useWorkspaceData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageMeta = pageTitles[location.pathname] || pageTitles['/app/rates'];
  const userDisplayName = userDetails?.username || 'Trader';
  const userRole = userDetails?.userType || 'FX Desk';
  const userRegion = userDetails?.region || 'Global';

  const userSummaryItems = useMemo(
    () => [
      { label: 'Email', value: userDetails?.email || 'n/a' },
      { label: 'Last sign-in', value: formatDateTime(userDetails?.lastLoginTimestamp) },
      { label: 'Feed', value: `Updated ${formatRelativeTime(workspaceData.lastUpdated)}` },
    ],
    [userDetails?.email, userDetails?.lastLoginTimestamp, workspaceData.lastUpdated]
  );

  const drawerContent = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box component="img" src={ecxIcon} alt="eCX" sx={{ width: 36, height: 36, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.light" sx={{ letterSpacing: 1.4, lineHeight: 1.2 }}>
              eCX
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              FX trading workspace
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Paper
        sx={{
          mx: 2,
          p: 1.5,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.common.white, 0.04),
          border: 'none',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.95rem', fontWeight: 700 }}>
            {userDisplayName.charAt(0)?.toUpperCase() || 'T'}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {userDisplayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {userRole}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton
              size="small"
              color="inherit"
              onClick={() => {
                logout();
                navigate('/');
              }}
              sx={{ color: 'text.secondary' }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" gap={0.75} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
          <Chip size="small" label={userRegion} variant="outlined" sx={{ height: 22 }} />
          <Chip size="small" label={`${trades.length} trades`} variant="outlined" sx={{ height: 22 }} />
        </Stack>

        <Divider sx={{ my: 1.25 }} />

        <Stack spacing={0.85}>
          {userSummaryItems.map((item) => (
            <Stack key={item.label} direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {item.label}
              </Typography>
              <Typography variant="caption" sx={{ textAlign: 'right', maxWidth: 150 }}>
                {item.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Box sx={{ px: 2, pt: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
          Navigation
        </Typography>
      </Box>

      <List sx={{ px: 1.25, py: 1.25, flexGrow: 1 }}>
        {navigationItems.map((item) => {
          const selected = location.pathname.startsWith(item.path);

          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                mb: 0.5,
                minHeight: 46,
                borderRadius: 1,
                px: 1.2,
                color: selected ? 'text.primary' : 'text.secondary',
                border: '1px solid transparent',
                '& .MuiListItemIcon-root': {
                  color: selected ? 'primary.light' : 'text.secondary',
                },
                '& .MuiListItemText-primary': {
                  fontSize: '0.94rem',
                  fontWeight: selected ? 700 : 600,
                },
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  borderColor: alpha(theme.palette.primary.light, 0.2),
                },
                '&.Mui-selected:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.18),
                },
                '&:hover': {
                  bgcolor: alpha(theme.palette.common.white, 0.04),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 34,
                  mr: 0.75,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          bgcolor: 'rgba(4, 9, 19, 0.7)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 72, md: 80 }, px: { xs: 2, md: 3 } }}>
          {!isDesktop ? (
            <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 1.25 }}>
              <MenuRoundedIcon />
            </IconButton>
          ) : null}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" noWrap>
              {pageMeta.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {pageMeta.subtitle}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title="Refresh live market data">
              <IconButton color="inherit" onClick={workspaceData.refresh}>
                <SyncRoundedIcon />
              </IconButton>
            </Tooltip>
            <Chip label={workspaceData.isDemo ? 'Demo' : 'Live'} color={workspaceData.isDemo ? 'warning' : 'primary'} />
            <Tooltip title="Sign out">
              <IconButton
                color="inherit"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                <LogoutRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'rgba(4, 9, 19, 0.96)',
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 72, md: 80 } }} />
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
        <Toolbar sx={{ minHeight: { xs: 72, md: 80 } }} />
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: { xs: 12, lg: 3 }, maxWidth: 1600, mx: 'auto' }}>
          <Outlet context={workspaceData} />
        </Box>
      </Box>

      {!isDesktop ? (
        <Paper
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: theme.zIndex.appBar,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'rgba(11, 23, 40, 0.88)',
          }}
        >
          <BottomNavigation
            showLabels
            value={navigationItems.find((item) => location.pathname.startsWith(item.path))?.path || '/app/rates'}
            onChange={(_, nextValue) => navigate(nextValue)}
            sx={{ bgcolor: 'transparent' }}
          >
            {navigationItems.slice(0, 5).map((item) => (
              <BottomNavigationAction key={item.path} label={item.label} value={item.path} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}
    </Box>
  );
}

export default FXTradingApp;
