import { useState } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Chip,
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
import AddCardRoundedIcon from '@mui/icons-material/AddCardRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from './UserProvider';
import useWorkspaceData from './useWorkspaceData';
import ecxIcon from '../assets/eCX-icon.svg';

const drawerWidth = 248;

interface NavigationItem {
  label: string;
  mobileLabel?: string;
  path: string;
  icon: SvgIconComponent;
  hasBadge?: boolean;
}

const navigationItems: NavigationItem[] = [
  { label: 'Rates', mobileLabel: 'Rates', path: '/app/rates', icon: CandlestickChartRoundedIcon },
  { label: 'Limit orders', mobileLabel: 'Orders', path: '/app/limit-orders', icon: PendingActionsRoundedIcon },
  { label: 'Notifications', mobileLabel: 'Alerts', path: '/app/notifications', icon: NotificationsRoundedIcon, hasBadge: true },
  { label: 'Booking', mobileLabel: 'Book', path: '/app/booking', icon: AddCardRoundedIcon },
  { label: 'Blotter', mobileLabel: 'Blotter', path: '/app/blotter', icon: ReceiptLongRoundedIcon },
  { label: 'Analysis', path: '/app/analysis', icon: InsightsRoundedIcon },
];

const pageTitles: Record<string, string> = {
  '/app/rates': 'Rates',
  '/app/limit-orders': 'Limit orders',
  '/app/notifications': 'Notifications',
  '/app/booking': 'Booking',
  '/app/blotter': 'Trade blotter',
  '/app/analysis': 'Market analysis',
};

function FXTradingApp() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { userDetails, logout } = useUser();
  const workspaceData = useWorkspaceData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || pageTitles['/app/rates'];
  const userDisplayName = userDetails?.username || 'Trader';
  const userRole = userDetails?.userType || 'FX Desk';
  const notificationCount = workspaceData.notificationCount || 0;

  const renderNavigationIcon = (item: NavigationItem) => {
    const Icon = item.icon;
    const iconNode = <Icon />;

    if (!item.hasBadge) {
      return iconNode;
    }

    return (
      <Badge badgeContent={notificationCount} color="primary" max={99} invisible={!notificationCount}>
        {iconNode}
      </Badge>
    );
  };

  const drawerContent = (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.25 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box component="img" src={ecxIcon} alt="eCX" sx={{ width: 34, height: 34, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
              eCX Trading
            </Typography>
            <Typography variant="caption" color="text.secondary">FX workspace</Typography>
          </Box>
        </Stack>
      </Box>

      <Paper
        sx={{
          mx: 1.5,
          p: 1.25,
          borderRadius: 1,
          bgcolor: 'background.default',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.85rem', fontWeight: 600 }}>
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

      </Paper>

      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1 }}>
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
                  fontWeight: selected ? 600 : 500,
                },
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  borderColor: alpha(theme.palette.primary.main, 0.12),
                },
                '&.Mui-selected:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                },
                '&:hover': {
                  bgcolor: 'action.hover',
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
                {renderNavigationIcon(item)}
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
          borderBottom: `1px solid ${theme.palette.divider}`,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 }, px: { xs: 2, md: 3 } }}>
          {!isDesktop ? (
            <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 1.25 }}>
              <MenuRoundedIcon />
            </IconButton>
          ) : null}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {pageTitle}
            </Typography>
          </Box>

          <Stack direction="row" spacing={{ xs: 0.25, sm: 1 }} sx={{ alignItems: 'center' }}>
            <Tooltip title="Refresh workspace">
              <IconButton color="inherit" onClick={() => workspaceData.requestRefresh()}>
                <SyncRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton color="inherit" onClick={() => navigate('/app/notifications')}>
                <Badge badgeContent={notificationCount} color="primary" max={99} invisible={!notificationCount}>
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Chip label={workspaceData.isDemo ? 'Demo' : 'Live'} variant="outlined" size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
            <Tooltip title="Sign out">
              <IconButton
                color="inherit"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
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
            bgcolor: 'background.paper',
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 } }} />
        <Box sx={{ px: { xs: 1.5, sm: 2, md: 3 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 11, lg: 3 }, maxWidth: 1600, mx: 'auto' }}>
          <Outlet context={workspaceData} />
        </Box>
      </Box>

      {!isDesktop ? (
        <Paper
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: theme.zIndex.appBar,
            borderRadius: 0,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
          }}
        >
          <BottomNavigation
            showLabels
            value={navigationItems.find((item) => location.pathname.startsWith(item.path))?.path || '/app/rates'}
            onChange={(_event, nextValue: string) => navigate(nextValue)}
            sx={{
              bgcolor: 'transparent',
              pb: 'env(safe-area-inset-bottom)',
              '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5 },
              '& .MuiBottomNavigationAction-label': { fontSize: '0.68rem' },
            }}
          >
            {navigationItems.slice(0, 5).map((item) => (
              <BottomNavigationAction key={item.path} label={item.mobileLabel || item.label} value={item.path} icon={renderNavigationIcon(item)} />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}
    </Box>
  );
}

export default FXTradingApp;
