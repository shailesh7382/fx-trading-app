import { alpha, createTheme } from '@mui/material/styles';

const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4ef2c2',
      contrastText: '#04111f',
    },
    secondary: {
      main: '#6ea8ff',
    },
    success: {
      main: '#2bd576',
    },
    error: {
      main: '#ff6b81',
    },
    warning: {
      main: '#ffc857',
    },
    background: {
      default: '#07111f',
      paper: '#0b1728',
    },
    text: {
      primary: '#f5f7fb',
      secondary: '#9bb0c7',
    },
    divider: alpha('#d9e4f5', 0.08),
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: [
      'Inter',
      'SF Pro Display',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            'radial-gradient(circle at top, rgba(78, 242, 194, 0.14), transparent 28%), linear-gradient(180deg, #07111f 0%, #040913 100%)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#d9e4f5', 0.08)}`,
          backdropFilter: 'blur(18px)',
          boxShadow: '0 24px 70px rgba(1, 8, 20, 0.36)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          border: `1px solid ${alpha('#d9e4f5', 0.08)}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
  },
});

export default appTheme;

