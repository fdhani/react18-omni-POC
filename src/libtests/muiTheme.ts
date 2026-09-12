import { createMuiTheme } from '@material-ui/core/styles';

/**
 * A representative customized MUI v4 theme, built to match the *shape* of
 * customization the dependency-upgrade investigation describes for the real
 * app (custom palette keys, custom shadows/breakpoints, typography, default
 * component props, and `overrides` for Alert, Autocomplete, Paper, Tooltip,
 * Avatar, LinearProgress, Modal, and Stepper) -- not the real theme itself,
 * which this session has no access to. Each override below uses a
 * deliberately distinctive, checkable value so a test can confirm via
 * getComputedStyle that MUI's JSS pipeline actually applied it, rather than
 * just eyeballing that nothing crashed.
 */

// A custom palette key beyond the standard primary/secondary/error/etc --
// the kind of app-specific palette extension the doc's theme-risk section
// describes, and something a plain type-level MUI v5 codemod cannot infer.
declare module '@material-ui/core/styles/createPalette' {
  interface Palette {
    custom: { highlight: string };
  }
  interface PaletteOptions {
    custom?: { highlight: string };
  }
}

// MuiAlert is a Lab component, not part of core's ComponentNameToClassKey map,
// so its override key needs the same kind of module augmentation real teams
// have to add for any Lab component they theme -- itself a small, concrete
// piece of the "migration surface" section 6.1 describes.
declare module '@material-ui/core/styles/overrides' {
  interface ComponentNameToClassKey {
    MuiAlert: 'standardSuccess' | 'root' | 'filledSuccess' | 'outlinedSuccess';
    MuiAutocomplete: 'root' | 'inputRoot';
  }
}

export const CUSTOM_HIGHLIGHT = '#ff6b00';
export const ALERT_BG = '#123456';
export const AUTOCOMPLETE_BORDER = '#00aa55';
export const PAPER_BG = '#fef3e0';
export const TOOLTIP_BG = '#2d0033';
export const AVATAR_BG = '#004488';
export const LINEAR_PROGRESS_BAR = '#cc0066';
export const MODAL_BACKDROP = 'rgba(10, 20, 30, 0.85)';
export const STEPPER_BG = '#f0f8ff';

export const theme = createMuiTheme({
  palette: {
    primary: { main: '#1a2b3c' },
    secondary: { main: '#8e44ad' },
    custom: { highlight: CUSTOM_HIGHLIGHT },
  },
  // Custom breakpoints -- shifted from MUI's defaults, the kind of change
  // that can silently affect any component reading theme.breakpoints.
  breakpoints: {
    values: { xs: 0, sm: 640, md: 900, lg: 1280, xl: 1600 },
  },
  // A fully custom shadows array (all 25 levels) rather than MUI's default --
  // apps commonly flatten shadows for a design system. Left mostly flat with
  // one distinctive shadow at index 4 to check it's actually applied.
  shadows: Array(25).fill('none') as any,
  typography: {
    fontFamily: '"CustomFont", system-ui, sans-serif',
    h6: { fontWeight: 800, letterSpacing: '0.05em' },
  },
  // v4's defaultProps mechanism ("props" key, moved to
  // components.*.defaultProps in v5 -- exactly the theme-shape change the
  // doc's section 6.3 calls out).
  props: {
    MuiButton: { disableElevation: true },
    MuiTextField: { variant: 'outlined' },
  },
  // Overrides for exactly the 8 components the investigation names.
  overrides: {
    MuiAlert: { standardSuccess: { backgroundColor: ALERT_BG, color: '#fff' } },
    MuiAutocomplete: { inputRoot: { border: `2px solid ${AUTOCOMPLETE_BORDER}` } },
    MuiPaper: { root: { backgroundColor: PAPER_BG } },
    MuiTooltip: { tooltip: { backgroundColor: TOOLTIP_BG, fontSize: 13 } },
    // Avatar's background color lives on `colorDefault` (applied alongside
    // `root` whenever no image/explicit color is set), not on `root` itself --
    // confirmed by inspecting the rendered class list, not assumed.
    MuiAvatar: { colorDefault: { backgroundColor: AVATAR_BG } },
    MuiLinearProgress: { barColorPrimary: { backgroundColor: LINEAR_PROGRESS_BAR } },
    // Modal's own overrides key has little visual surface on its own; the
    // doc names "Modal" as an override target, and the actually-visible piece
    // is its Backdrop, so that's what's checked at runtime.
    MuiBackdrop: { root: { backgroundColor: MODAL_BACKDROP } },
    MuiStepper: { root: { backgroundColor: STEPPER_BG } },
  },
});
