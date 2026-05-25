import React, { useContext, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { Navigate, useNavigate } from 'react-router-dom';
import UserContext from './UserContext';
import { extractApiMessage } from '../api/client';

const featureCards = [
  {
    title: 'Live pricing panels',
    description: 'Fast buy/sell actions, spread awareness, and cleaner instrument scanning.',
    icon: <CandlestickChartRoundedIcon color="primary" />,
  },
  {
    title: 'Ticket-first workflow',
    description: 'Review quote, assign coverage, validate dates, and book with less friction.',
    icon: <InsightsRoundedIcon color="secondary" />,
  },
  {
    title: 'Fully mobile ready',
    description: 'Responsive navigation, larger tap targets, and compact analytics for smaller screens.',
    icon: <PhoneIphoneRoundedIcon color="success" />,
  },
];

function Login() {
  const navigate = useNavigate();
  const { userDetails, login, startDemoSession } = useContext(UserContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');

  if (userDetails) {
    return <Navigate to="/app" replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      await login({ username, password });
      setSeverity('success');
      setMessage('Authenticated. Redirecting to your trading workspace.');
      navigate('/app');
    } catch (error) {
      setSeverity('error');
      setMessage(extractApiMessage(error, 'Authentication failed. Use demo mode if the service is offline.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    startDemoSession(username || 'demo.trader');
    navigate('/app');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(360px, 0.85fr)' },
          }}
        >
          <Paper sx={{ p: { xs: 2.5, md: 4 }, position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at top left, rgba(78, 242, 194, 0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(110, 168, 255, 0.18), transparent 35%)',
                pointerEvents: 'none',
              }}
            />
            <Stack spacing={3} sx={{ position: 'relative' }}>
              <Box>
                <Chip icon={<ShieldRoundedIcon />} label="Vite-upgraded FX workspace" color="primary" sx={{ mb: 2 }} />
                <Typography variant="h2" sx={{ maxWidth: 720, fontSize: { xs: '2.3rem', md: '3.5rem' } }}>
                  FX Trading Workspace
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 680, mt: 1.5, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  A sleeker dealing experience with a clearer user journey from live rates to booking, blotter, market
                  analysis, and portfolio monitoring — tuned for desktop and mobile.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                {featureCards.map((card) => (
                  <Paper key={card.title} sx={{ p: 2, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                    <Stack spacing={1.25}>
                      {card.icon}
                      <Typography variant="h6">{card.title}</Typography>
                      <Typography color="text.secondary">{card.description}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Chip label="Live pricing + demo fallback" variant="outlined" />
                <Chip label="Responsive shell + bottom navigation" variant="outlined" />
                <Chip label="Session & trade persistence" variant="outlined" />
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, alignSelf: 'center' }}>
            <Stack spacing={2.5} component="form" onSubmit={handleLogin}>
              <Box>
                <Typography variant="h4">Sign in</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  Connect to the auth service, or continue with a demo session if backend services are unavailable.
                </Typography>
              </Box>

              {message ? <Alert severity={severity}>{message}</Alert> : null}

              <TextField
                label="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="fx.trader"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRoundedIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRoundedIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Stack spacing={1.25}>
                <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in…' : 'Sign in to workspace'}
                </Button>
                <Button type="button" variant="outlined" size="large" onClick={handleDemoMode}>
                  Continue in demo mode
                </Button>
              </Stack>

              <Paper sx={{ p: 1.75, bgcolor: 'rgba(7, 17, 31, 0.55)' }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Operator notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The app now gracefully falls back to demo market data and local trade capture so the UX remains
                  reviewable even when `/api/login` or pricing endpoints are offline.
                </Typography>
              </Paper>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

export default Login;
