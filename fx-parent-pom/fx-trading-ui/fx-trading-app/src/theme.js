import { alpha, createTheme } from '@mui/material/styles';

const brandBlue = '#005EB8';
const brandBlueLight = '#2C82D6';
const brandBlueDark = '#00488D';
const brandBlueGlow = '#4FA2F0';
const ink900 = '#030A14';
const ink850 = '#06111F';
const ink800 = '#081827';
const ink750 = '#0B1E30';
const ink700 = '#10263C';
const borderTint = alpha('#8FBDE8', 0.16);

const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: brandBlue,
      light: brandBlueLight,
      dark: brandBlueDark,
      contrastText: '#f5f7fb',
    },
    secondary: {
      main: brandBlueGlow,
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
      default: ink850,
      paper: ink750,
    },
    text: {
      primary: '#f5f7fb',
      secondary: '#A7BED8',
    },
    divider: borderTint,
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
            `radial-gradient(circle at top, ${alpha(brandBlue, 0.28)}, transparent 30%), radial-gradient(circle at top right, ${alpha(brandBlueGlow, 0.16)}, transparent 24%), linear-gradient(180deg, ${ink850} 0%, ${ink900} 100%)`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(ink750, 0.9),
          border: `1px solid ${borderTint}`,
          backdropFilter: 'blur(18px)',
          boxShadow: `0 24px 70px ${alpha('#010814', 0.42)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          border: `1px solid ${alpha(brandBlueGlow, 0.12)}`,
          backgroundColor: alpha(ink700, 0.76),
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
        containedPrimary: {
          backgroundImage: `linear-gradient(135deg, ${brandBlueLight} 0%, ${brandBlue} 65%, ${brandBlueDark} 100%)`,
        },
        outlined: {
          borderColor: alpha(brandBlueGlow, 0.28),
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
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(ink800, 0.82),
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(brandBlueGlow, 0.3),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: brandBlueLight,
            boxShadow: `0 0 0 1px ${alpha(brandBlueLight, 0.18)}`,
          },
        },
        notchedOutline: {
          borderColor: borderTint,
        },
      },
    },
  },
});

export default appTheme;

