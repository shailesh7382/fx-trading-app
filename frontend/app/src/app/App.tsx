import { CssBaseline, ThemeProvider } from '@mui/material';
import { UserProvider } from '@/features/auth/UserProvider';
import AppRoutes from '@/app/routes';
import appTheme from '@/app/theme';

/** Application root: session, theme, then the route table. */
export default function App() {
  return (
    <UserProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppRoutes />
      </ThemeProvider>
    </UserProvider>
  );
}
