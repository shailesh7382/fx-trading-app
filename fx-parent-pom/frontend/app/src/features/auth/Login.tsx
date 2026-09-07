import { useState, type FormEvent } from 'react';
import type { AlertColor } from '@mui/material';
import {
  Alert,
  Box,
  Button,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/features/auth/UserProvider';
import { extractApiMessage } from '@/shared/api/client';
import ecxIcon from '@/assets/eCX-icon.svg';

function Login() {
  const navigate = useNavigate();
  const { userDetails, login, startDemoSession } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  if (userDetails) {
    return <Navigate to="/app" replace />;
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      await login({ username, password });
      setSeverity('success');
      setMessage('Signed in.');
      navigate('/app');
    } catch (error) {
      setSeverity('error');
      setMessage(extractApiMessage(error, 'Sign-in failed. Try demo mode if the service is unavailable.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    startDemoSession(username || 'demo.trader');
    navigate('/app');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Container maxWidth="sm">
          <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Stack spacing={2.5} component="form" onSubmit={handleLogin}>
              <Box>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2.5 }}>
                  <Box component="img" src={ecxIcon} alt="eCX" sx={{ width: 40, height: 40 }} />
                  <Typography variant="subtitle1">eCX Trading</Typography>
                </Stack>
                <Typography variant="h4">FX Trading Platform</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  Sign in to continue.
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
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
                <Button type="button" variant="text" size="large" onClick={handleDemoMode}>
                  Continue in demo mode
                </Button>
              </Stack>
            </Stack>
          </Paper>
      </Container>
    </Box>
  );
}

export default Login;
