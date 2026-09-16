import { createTheme } from '@mui/material/styles';

/**
 * Prototype theme. Scoped by rendering under <ScopedCssBaseline>, so nothing
 * here reaches the react-stack-grid repro at "/".
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' },
    warning: { main: '#b54708' },
    background: { default: '#f7f8fa' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 14,
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#667085',
          backgroundColor: '#f9fafb',
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
