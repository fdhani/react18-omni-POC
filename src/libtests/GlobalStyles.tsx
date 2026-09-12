import * as React from 'react';
import { withStyles } from '@material-ui/core/styles';

/**
 * Matches the real app's GlobalStyles.tsx: `withStyles({ '@global': {...} })`
 * on a component that renders nothing, purely to inject global (unscoped)
 * JSS rules -- MUI v4's standard pattern before CssBaseline/emotion-based
 * global styles, and a distinct JSS feature (the `@global` at-rule) from
 * anything else tested so far (component-scoped overrides, makeStyles
 * hooks, or withStyles used *with* a rendered element as in StepIcon).
 *
 * The real app doesn't use CssBaseline or StylesProvider at all (0 files),
 * so this -- global JSS -- is the actual mechanism global styling goes
 * through, which is exactly why the CSS *injection order* between this and
 * a plain imported stylesheet (see ReactSlickDemo.tsx) matters.
 */
export const GLOBAL_MARKER_COLOR = '#ff4400';

const styles = {
  '@global': {
    '[data-global-style-target]': {
      color: GLOBAL_MARKER_COLOR,
      fontWeight: 700,
    },
  },
};

function GlobalStylesBase() {
  return null;
}

export const GlobalStyles = withStyles(styles)(GlobalStylesBase);
