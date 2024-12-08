// src/fxapp/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import { TextField, Button, Typography, Container, Box } from '@mui/material';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [userDetails, setUserDetails] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const loginRequest = {
        username: username,
        password: password
      };
      const response = await axios.post('http://localhost:8080/api/login', loginRequest);
      setUserDetails(response.data);
      setMessage(`Login successful: ${response.data.message}`);
    } catch (error) {
      setMessage('Login failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Login
        </Typography>
        <form onSubmit={handleLogin}>
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Box>
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Box>
          <Button type="submit" variant="contained" color="primary" fullWidth>
            Login
          </Button>
        </form>
        {message && (
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        {userDetails && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">Username: {userDetails.username}</Typography>
            <Typography variant="body1">Email: {userDetails.email}</Typography>
            <Typography variant="body1">User Type: {userDetails.userType}</Typography>
            <Typography variant="body1">Last Login: {userDetails.lastLoginTimestamp}</Typography>
            <Typography variant="body1">Region: {userDetails.region}</Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default Login;