import { alpha, createTheme } from '@mui/material/styles';

const blue = '#2563A8';
const blueLight = '#4C82BD';
const blueDark = '#174A7E';
const slate900 = '#1F2A37';
const slate600 = '#617083';
const canvas = '#F4F7FA';
const border = '#D9E1EA';

const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: blue,
      light: blueLight,
      dark: blueDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#6688AD',
      light: '#8EA8C3',
      dark: '#496B90',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#3973AD',
      light: '#EAF2FA',
      dark: '#245680',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#355D88',
      light: '#EDF2F7',
      dark: '#244766',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#6B7F95',
      light: '#F1F4F7',
      dark: '#4A5D70',
      contrastText: '#FFFFFF',
    },
    info: {
      main: blueLight,
      light: '#EDF5FC',
      dark: blueDark,
      contrastText: '#FFFFFF',
    },
    background: {
      default: canvas,
      paper: '#FFFFFF',
    },
    text: {
      primary: slate900,
      secondary: slate600,
    },
    divider: border,
    action: {
      hover: alpha(blue, 0.05),
      selected: alpha(blue, 0.09),
      focus: alpha(blue, 0.12),
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 650, letterSpacing: '-0.025em' },
    h2: { fontWeight: 650, letterSpacing: '-0.025em' },
    h3: { fontWeight: 650, letterSpacing: '-0.02em' },
    h4: { fontWeight: 650, letterSpacing: '-0.015em' },
    h5: { fontWeight: 650 },
    h6: { fontWeight: 650 },
    subtitle1: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: canvas,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          border: `1px solid ${border}`,
          boxShadow: `0 1px 2px ${alpha(blueDark, 0.04)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          border: `1px solid ${border}`,
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 18,
          '&:last-child': {
            paddingBottom: 18,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: 14,
        },
        containedPrimary: {
          backgroundColor: blue,
          backgroundImage: 'none',
          '&:hover': {
            backgroundColor: blueDark,
          },
        },
        outlined: {
          borderColor: '#C7D3E0',
          '&:hover': {
            borderColor: blueLight,
            backgroundColor: alpha(blue, 0.04),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
        filled: {
          backgroundColor: '#EAF1F8',
          color: blueDark,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: 'none',
        },
        standardSuccess: {
          backgroundColor: '#EAF2FA',
          color: blueDark,
        },
        standardError: {
          backgroundColor: '#EDF2F7',
          color: '#244766',
        },
        standardWarning: {
          backgroundColor: '#F1F4F7',
          color: '#4A5D70',
        },
        standardInfo: {
          backgroundColor: '#EDF5FC',
          color: blueDark,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#AEBFD0',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: blue,
            boxShadow: `0 0 0 2px ${alpha(blue, 0.08)}`,
          },
        },
        notchedOutline: {
          borderColor: '#C7D3E0',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#E5EBF1',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: blueDark,
        },
      },
    },
  },
});

export default appTheme;
