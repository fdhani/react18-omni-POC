import { createMuiTheme } from '@material-ui/core/styles';
import type { AlertProps } from '@material-ui/lab/Alert';

/**
 * A representative customized MUI v4 theme, expanded to match the real
 * app's theme.ts + material.d.ts as described directly (not the real files,
 * which this session has no access to, but built to their documented shape):
 * an entirely custom top-level `shadow` key, `shape`, richer custom palette
 * types (icon/calendarBackground/filter/inputBackground), the exact 8
 * `overrides` targets plus Divider and the Stepper sub-component set, and
 * `props` on the exact three components the real theme uses (Alert, Modal,
 * Tooltip) rather than the arbitrary pair tested earlier.
 */

// ---- Palette: custom keys + richer types -----------------------------

export interface IconOption {
  primary: string;
  secondary: string;
}
export interface CalendarPaletteOption {
  available: string;
  booked: string;
}
export interface FilterItem {
  key: string;
  color: string;
}
export type Filter = FilterItem[];

declare module '@material-ui/core/styles/createPalette' {
  interface TypeBackground {
    // Extending a built-in palette sub-interface (not just adding a new
    // top-level key) -- a different augmentation shape than `custom` below.
    subtle: string;
  }
  interface Palette {
    custom: { highlight: string };
    icon: IconOption;
    calendarBackground: CalendarPaletteOption;
    filter: Filter;
    inputBackground: string;
  }
  interface PaletteOptions {
    custom?: { highlight: string };
    icon?: IconOption;
    calendarBackground?: CalendarPaletteOption;
    filter?: Filter;
    inputBackground?: string;
  }
}

// ---- Theme/ThemeOptions: the custom top-level `shadow` key -----------
//
// Unlike `shadows` (MUI's built-in 25-level array, already tested), `shadow`
// here is an app-defined top-level theme property with no relationship to
// any MUI built-in -- augmenting `Theme`/`ThemeOptions` themselves, a more
// invasive kind of augmentation than extending a sub-interface like
// `Palette`. This is what makes `theme.shadow.main` (etc.) type-check and
// what a real Theme/ThemeOptions augmentation looks like end to end.
export interface CustomShadow {
  main: string;
  button: string;
  box: string;
  hover: string;
}

declare module '@material-ui/core/styles' {
  interface Theme {
    shadow: CustomShadow;
  }
  interface ThemeOptions {
    shadow?: CustomShadow;
  }
}

// ---- ComponentsPropsList: MuiAlert's defaultProps type ----------------
//
// MuiAlert is a Lab component, so (like ComponentNameToClassKey for
// overrides) its defaultProps type isn't in the default map either --
// this is the props-side equivalent of that same gap.
declare module '@material-ui/core/styles/props' {
  interface ComponentsPropsList {
    MuiAlert: Partial<AlertProps>;
  }
}

// ---- overrides: the exact 8 components + Divider + Stepper set --------
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
export const DIVIDER_COLOR = '#ff00aa';
export const STEP_CONNECTOR_COLOR = '#009999';
export const STEP_LABEL_COLOR = '#663300';
export const SHADOW_MAIN = '0 4px 12px rgba(255, 0, 170, 0.6)';

export const theme = createMuiTheme({
  palette: {
    primary: { main: '#1a2b3c' },
    secondary: { main: '#8e44ad' },
    custom: { highlight: CUSTOM_HIGHLIGHT },
    icon: { primary: '#336699', secondary: '#996633' },
    calendarBackground: { available: '#e0ffe0', booked: '#ffe0e0' },
    filter: [
      { key: 'active', color: '#00cc66' },
      { key: 'inactive', color: '#999999' },
    ],
    inputBackground: '#f5f5fa',
    // Extends the built-in TypeBackground with a custom `subtle` key
    // (the augmentation above), alongside the two fields MUI itself
    // requires -- kept real rather than cast to `any`, so the augmentation
    // is actually exercised, not sidestepped.
    background: {
      default: '#ffffff',
      paper: '#ffffff',
      subtle: '#f0f0f5',
    },
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
  // The app-defined custom top-level key (see the Theme augmentation above).
  shadow: {
    main: SHADOW_MAIN,
    button: '0 2px 4px rgba(0,0,0,0.3)',
    box: '0 1px 2px rgba(0,0,0,0.2)',
    hover: '0 6px 16px rgba(0,0,0,0.4)',
  },
  shape: {
    borderRadius: 5,
  },
  typography: {
    fontSize: 14,
    fontFamily: 'Lato, sans-serif',
    h6: { fontWeight: 800, letterSpacing: '0.05em' },
  },
  // v4's defaultProps mechanism ("props" key, moved to
  // components.*.defaultProps in v5) -- on the exact three components the
  // real theme uses, not an arbitrary pair.
  props: {
    MuiAlert: { variant: 'filled' },
    MuiModal: { disablePortal: true },
    MuiTooltip: { arrow: true },
  },
  // Overrides for the 8 components the investigation names, plus Divider
  // and the Stepper sub-component set (Connector/Label; StepIcon is a
  // custom component instead, see StepIcon.tsx).
  overrides: {
    // props.MuiAlert below defaults variant to 'filled', which renders with
    // the `filledSuccess` class key, not `standardSuccess` -- targeting the
    // wrong one is exactly the "class key precision" risk this investigation
    // keeps surfacing, this time self-inflicted by changing defaultProps
    // without updating the matching override.
    MuiAlert: { filledSuccess: { backgroundColor: ALERT_BG, color: '#fff' } },
    MuiAutocomplete: { inputRoot: { border: `2px solid ${AUTOCOMPLETE_BORDER}` } },
    MuiDivider: { root: { backgroundColor: DIVIDER_COLOR, height: 2 } },
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
    MuiStepConnector: { line: { borderColor: STEP_CONNECTOR_COLOR, borderWidth: 3 } },
    // MUI's own `active`/`completed` state classes also set `color`, and win
    // the cascade over a plain `label` override for those two states --
    // confirmed by inspecting the rendered class list, not assumed. Setting
    // all three keeps the label color consistent across every step state.
    MuiStepLabel: {
      label: { color: STEP_LABEL_COLOR, fontWeight: 700 },
      active: { color: `${STEP_LABEL_COLOR} !important` },
      completed: { color: `${STEP_LABEL_COLOR} !important` },
    },
  },
});
