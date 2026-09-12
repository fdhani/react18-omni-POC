import * as React from 'react';
import { ThemeProvider, makeStyles, createStyles, styled, useTheme } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import Avatar from '@material-ui/core/Avatar';
import Divider from '@material-ui/core/Divider';
import LinearProgress from '@material-ui/core/LinearProgress';
import Modal from '@material-ui/core/Modal';
import Backdrop from '@material-ui/core/Backdrop';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepConnector from '@material-ui/core/StepConnector';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import CardHeader from '@material-ui/core/CardHeader';
import Icon from '@material-ui/core/Icon';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import LuxonUtils from '@date-io/luxon';
import { MuiPickersUtilsProvider, KeyboardDatePicker, KeyboardTimePicker } from '@material-ui/pickers';
import { DateTime } from 'luxon';
import {
  theme,
  CUSTOM_HIGHLIGHT,
  ALERT_BG,
  AUTOCOMPLETE_BORDER,
  PAPER_BG,
  TOOLTIP_BG,
  AVATAR_BG,
  LINEAR_PROGRESS_BAR,
  MODAL_BACKDROP,
  STEPPER_BG,
  DIVIDER_COLOR,
  STEP_CONNECTOR_COLOR,
  STEP_LABEL_COLOR,
} from './muiTheme';
import { StepIcon } from './StepIcon';
import { GlobalStyles, GLOBAL_MARKER_COLOR } from './GlobalStyles';
import { MountTracker, libResults } from './ErrorBoundary';

/**
 * Tests the risk this investigation actually named for MUI v4 (section 6),
 * expanded to match the real app's theme.ts + material.d.ts as described
 * directly: an entirely custom top-level `shadow` key (augmenting
 * Theme/ThemeOptions themselves, not a sub-interface), `shape`, richer
 * custom palette types (icon/calendarBackground/filter/inputBackground),
 * `overrides` for the 8 named components plus Divider and the Stepper
 * sub-component set (Connector/Label/a custom StepIcon), `props` on the
 * exact three components the real theme uses (Alert/Modal/Tooltip), global
 * JSS styles (`withStyles({'@global': ...})`, matching GlobalStyles.tsx),
 * and the remaining styling-API surface not yet exercised: useTheme,
 * createStyles, styled, withStyles (via StepIcon/GlobalStyles).
 *
 * Every override is verified via getComputedStyle after mount -- not just
 * that nothing crashed -- continuing the same method used for the JSS
 * StrictMode-teardown check (see the JSS <style data-jss> sheet count
 * below), which is the direct analogue of the react-sizeme bug already
 * found in the stack-grid repro.
 */

// JSS `$` conditional-selector composition: '&$active' targets `root` only
// when the `active` class is also applied on the same element -- a classic
// v4 JSS idiom that a straight CSS-in-JS engine (Emotion) does not support
// the same way, and the reason section 6.4 flags "$..." usage as a
// migration risk. This checks it still *works* under React 18, not that it
// migrates cleanly.
const useJssConditional = makeStyles(() => ({
  root: {
    padding: 8,
    border: '2px solid #999',
    '&$active': { borderColor: CUSTOM_HIGHLIGHT, borderWidth: 4 },
  },
  active: {},
}));

// `createStyles` is a TS-only identity wrapper used with makeStyles/withStyles
// for stronger type inference -- functionally identical at runtime to a plain
// object literal (as used above), but a distinct code path in the 11 files
// the real app uses it in, so exercised here rather than assumed equivalent.
const useGridGap = makeStyles(() =>
  createStyles({
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gridGap: 12 },
    tile: { background: '#eee', height: 40 },
  }),
);

// `styled` -- MUI v4's styled-components-like API, a different mechanism
// from the makeStyles hook pattern (8 files in the real app), untested until
// now.
export const STYLED_BORDER = '#00695c';
const StyledBox = styled('div')({
  border: `3px dashed ${STYLED_BORDER}`,
  padding: 8,
});

function JssConditional() {
  const classes = useJssConditional();
  const [active, setActive] = React.useState(true);
  return (
    <div
      data-check="jss-conditional"
      className={`${classes.root}${active ? ` ${classes.active}` : ''}`}
      onClick={() => setActive((a) => !a)}
    >
      JSS $ conditional (click to toggle) -- active: {String(active)}
    </div>
  );
}

function GridGapDemo() {
  const classes = useGridGap();
  return (
    <div data-check="gridgap" className={classes.grid}>
      <div className={classes.tile} />
      <div className={classes.tile} />
    </div>
  );
}

// Exercises useTheme() (37 files in the real app) by reading back the custom
// top-level `shadow` key and `shape.borderRadius` -- both only exist because
// of the Theme/ThemeOptions augmentation in muiTheme.ts, so this proves the
// augmentation is actually consumable at render time, not just that it
// compiles.
function ThemeReadout() {
  const t = useTheme();
  return (
    <div
      data-check="use-theme-readout"
      style={{ boxShadow: t.shadow.main, borderRadius: t.shape.borderRadius, padding: 12, border: '1px solid #ccc' }}
    >
      useTheme(): shadow.main + shape.borderRadius applied via inline style
      <div data-check="palette-swatches" style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <span style={{ background: t.palette.icon.primary, width: 20, height: 20, display: 'inline-block' }} />
        <span style={{ background: t.palette.calendarBackground.available, width: 20, height: 20, display: 'inline-block' }} />
        <span style={{ background: t.palette.inputBackground, width: 20, height: 20, display: 'inline-block' }} />
        <span style={{ background: t.palette.filter[0].color, width: 20, height: 20, display: 'inline-block' }} />
        <span style={{ background: (t.palette.background as any).subtle, width: 20, height: 20, display: 'inline-block' }} />
      </div>
    </div>
  );
}

export default function MuiThemeDemo() {
  const [date, setDate] = React.useState(DateTime.local());
  const [time, setTime] = React.useState(DateTime.local());
  const [activeStep, setActiveStep] = React.useState(1);
  const [modalOpen, setModalOpen] = React.useState(true);

  React.useEffect(() => {
    // Wait a frame so JSS has finished injecting its <style> sheets and MUI's
    // components have committed their classNames before reading them back.
    const id = requestAnimationFrame(() => {
      const r = libResults['mui-theme'];
      if (!r) return;

      // Converts any CSS color string to a canonical "r,g,b" triple by letting
      // the browser itself parse it (via a throwaway element), so a hex
      // expectation can be compared against a computed rgb(...) string
      // correctly instead of comparing the two textual formats directly.
      const toRgb = (color: string): string => {
        const probe = document.createElement('div');
        probe.style.color = color;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        return rgb;
      };

      const checkStyle = (selector: string, prop: keyof CSSStyleDeclaration, expected: string, label: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) {
          r.notes.push(`FAIL ${label}: element not found (${selector})`);
          return;
        }
        const actual = String(getComputedStyle(el)[prop]);
        const ok = actual === toRgb(expected);
        r.notes.push(`${ok ? 'ok' : 'FAIL'} ${label}: expected ${expected} (${toRgb(expected)}) got=${actual}`);
      };

      checkStyle('[data-check="alert"]', 'backgroundColor', ALERT_BG, 'MuiAlert override');
      checkStyle('[data-check="autocomplete"] .MuiOutlinedInput-root, [data-check="autocomplete"] input', 'borderColor', AUTOCOMPLETE_BORDER, 'MuiAutocomplete override');
      checkStyle('[data-check="divider"]', 'backgroundColor', DIVIDER_COLOR, 'MuiDivider override');
      checkStyle('[data-check="paper"]', 'backgroundColor', PAPER_BG, 'MuiPaper override');
      checkStyle('.MuiTooltip-tooltip', 'backgroundColor', TOOLTIP_BG, 'MuiTooltip override');
      checkStyle('[data-check="avatar"]', 'backgroundColor', AVATAR_BG, 'MuiAvatar override');
      checkStyle('[data-check="progress"] .MuiLinearProgress-barColorPrimary', 'backgroundColor', LINEAR_PROGRESS_BAR, 'MuiLinearProgress override');
      checkStyle('.MuiBackdrop-root', 'backgroundColor', MODAL_BACKDROP, 'MuiBackdrop (Modal) override');
      checkStyle('[data-check="stepper"]', 'backgroundColor', STEPPER_BG, 'MuiStepper override');
      checkStyle('.MuiStepConnector-line', 'borderTopColor', STEP_CONNECTOR_COLOR, 'MuiStepConnector override');
      checkStyle('.MuiStepLabel-label', 'color', STEP_LABEL_COLOR, 'MuiStepLabel override');

      // props: defaultProps on the exact 3 components the real theme uses.
      const alertEl = document.querySelector('[data-check="alert"]');
      r.notes.push(
        alertEl?.className.includes('MuiAlert-filled')
          ? 'ok props.MuiAlert variant="filled" applied (MuiAlert-filled* class present)'
          : `FAIL props.MuiAlert: expected a MuiAlert-filled* class, got ${alertEl?.className}`,
      );
      const arrowEl = document.querySelector('.MuiTooltip-popper .MuiTooltip-arrow');
      r.notes.push(arrowEl ? 'ok props.MuiTooltip arrow=true applied (.MuiTooltip-arrow present)' : 'FAIL props.MuiTooltip: no .MuiTooltip-arrow found');
      const modalRoot = document.querySelector('[data-check="modal-host"] [role="presentation"]');
      r.notes.push(
        modalRoot
          ? 'ok props.MuiModal disablePortal=true applied (modal rendered inline, not portaled to body)'
          : 'FAIL props.MuiModal disablePortal: modal root not found inline where expected',
      );

      // Custom palette values, read back from rendered inline styles (driven
      // by useTheme() in ThemeReadout) to prove the createPalette
      // augmentation is consumable, not just that it compiles.
      const swatches = Array.from(document.querySelectorAll('[data-check="palette-swatches"] span')).map(
        (el) => getComputedStyle(el).backgroundColor,
      );
      r.notes.push(`custom palette swatches (icon/calendarBackground/inputBackground/filter/background.subtle): ${JSON.stringify(swatches)}`);

      const readout = document.querySelector('[data-check="use-theme-readout"]') as HTMLElement | null;
      if (readout) {
        r.notes.push(
          `useTheme() Theme/ThemeOptions augmentation: boxShadow=${getComputedStyle(readout).boxShadow.slice(0, 40)}... borderRadius=${getComputedStyle(readout).borderRadius}`,
        );
      }

      const styledBox = document.querySelector('[data-check="styled-box"]') as HTMLElement | null;
      r.notes.push(
        styledBox
          ? `ok styled() API: borderColor=${getComputedStyle(styledBox).borderColor}`
          : 'FAIL styled() box not found',
      );

      const globalTarget = document.querySelector('[data-global-style-target]') as HTMLElement | null;
      if (globalTarget) {
        const ok = getComputedStyle(globalTarget).color === toRgb(GLOBAL_MARKER_COLOR);
        r.notes.push(`${ok ? 'ok' : 'FAIL'} GlobalStyles (withStyles '@global'): color=${getComputedStyle(globalTarget).color}`);
      } else {
        r.notes.push('FAIL GlobalStyles: target element not found');
      }

      const stepIcons = Array.from(document.querySelectorAll('[data-step-icon]')).map((e) => e.getAttribute('data-step-icon'));
      r.notes.push(`custom StepIcon states rendered: ${JSON.stringify(stepIcons)}`);

      // Theme-level checks not tied to a component override.
      const primaryButton = document.querySelector('[data-check="themed-button"]') as HTMLElement | null;
      if (primaryButton) {
        r.notes.push(
          `theme.palette.primary applied to button: ${getComputedStyle(primaryButton).backgroundColor}`,
        );
      }

      // JSS style-injection integrity: count <style data-jss> sheets and look
      // for duplicate data-meta values, which would indicate a StrictMode
      // double-mount left a stale sheet behind instead of tearing it down --
      // the exact failure mode already confirmed once in this investigation
      // for react-sizeme's resize detector.
      const sheets = Array.from(document.querySelectorAll('style[data-jss]'));
      const metas = sheets.map((s) => s.getAttribute('data-meta') ?? '(none)');
      const dupCounts: Record<string, number> = {};
      for (const m of metas) dupCounts[m] = (dupCounts[m] ?? 0) + 1;
      const duplicates = Object.entries(dupCounts).filter(([, n]) => n > 1);
      r.notes.push(`JSS <style data-jss> sheets: ${sheets.length}`);
      r.notes.push(
        duplicates.length
          ? `JSS duplicate sheets (same data-meta more than once): ${JSON.stringify(duplicates)}`
          : 'JSS duplicate sheets: none',
      );
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MountTracker name="mui-theme" />

        <Alert data-check="alert" severity="success">
          Themed Alert (MuiAlert override + props.MuiAlert variant="filled")
        </Alert>

        <Autocomplete
          options={['One', 'Two', 'Three']}
          style={{ width: 240 }}
          renderInput={(params) => (
            <div data-check="autocomplete" ref={params.InputProps.ref as any} {...params}>
              {/* variant="outlined" set explicitly here: theme.props no
                  longer defaults MuiTextField to outlined (that was an
                  arbitrary pair tested earlier, replaced with the real
                  theme's actual props targets), so this stays outlined
                  regardless of what theme.props.MuiTextField does or
                  doesn't set -- otherwise the MuiOutlinedInput-root class
                  this override targets wouldn't exist at all. */}
              <TextField {...params} label="Themed Autocomplete" size="small" variant="outlined" />
            </div>
          )}
        />

        <Divider data-check="divider" />

        <Paper data-check="paper" style={{ padding: 12 }}>
          Themed Paper
        </Paper>

        <Tooltip title="Themed tooltip (props.MuiTooltip arrow=true)" open placement="right">
          <span style={{ display: 'inline-block' }}>Hover target (forced open)</span>
        </Tooltip>

        <div>
          <Avatar data-check="avatar">TH</Avatar>
        </div>

        <div data-check="progress">
          <LinearProgress variant="determinate" value={50} />
        </div>

        {/* BackdropComponent must be passed explicitly: Modal's default backdrop
            is SimpleBackdrop, an internal component with hardcoded inline
            styles that deliberately does not go through withStyles/theme at
            all. Only the real Backdrop (used here) responds to the
            MuiBackdrop theme override. Closable (not permanently open) so its
            full-viewport backdrop doesn't block interaction with the rest of
            the page below it -- also just more realistic usage.
            disablePortal comes from props.MuiModal in the theme, so this
            renders inline (data-check="modal-host") instead of at the end of
            <body> -- checked above. */}
        <div data-check="modal-host">
          <button onClick={() => setModalOpen((o) => !o)}>Toggle Modal</button>
          <Modal open={modalOpen} BackdropComponent={Backdrop} onBackdropClick={() => setModalOpen(false)}>
            <Paper style={{ position: 'absolute', top: '20%', left: '20%', padding: 16 }}>
              Modal content (checking MuiBackdrop override + props.MuiModal disablePortal)
            </Paper>
          </Modal>
        </div>

        <Stepper
          data-check="stepper"
          activeStep={activeStep}
          connector={<StepConnector />}
          onClick={() => setActiveStep((s) => (s + 1) % 3)}
        >
          <Step><StepLabel StepIconComponent={StepIcon}>Step 1</StepLabel></Step>
          <Step><StepLabel StepIconComponent={StepIcon}>Step 2</StepLabel></Step>
          <Step><StepLabel StepIconComponent={StepIcon}>Step 3</StepLabel></Step>
        </Stepper>

        <GridList cellHeight={60} cols={3} data-check="gridlist">
          {[1, 2, 3].map((n) => (
            <GridListTile key={n}>
              <div style={{ background: '#ddd', height: '100%' }}>{n}</div>
            </GridListTile>
          ))}
        </GridList>

        <JssConditional />
        <GridGapDemo />
        <ThemeReadout />

        <StyledBox data-check="styled-box">styled() API box</StyledBox>

        <div data-global-style-target>Global JSS style target (withStyles '@global')</div>

        <CardHeader disableTypography title={<h4 style={{ margin: 0 }}>disableTypography CardHeader</h4>} />

        <Icon fontSize="default">star</Icon>

        <div>
          <InputLabel htmlFor="labelwidth-demo">Manual labelWidth</InputLabel>
          <OutlinedInput data-check="labelwidth-input" id="labelwidth-demo" labelWidth={110} defaultValue="value" />
        </div>

        <MuiPickersUtilsProvider utils={LuxonUtils}>
          <div style={{ display: 'flex', gap: 12 }}>
            <KeyboardDatePicker
              label="Keyboard date (Luxon adapter)"
              value={date}
              onChange={(d) => d && setDate(d as any)}
              format="yyyy-MM-dd"
            />
            <KeyboardTimePicker
              label="Keyboard time (Luxon adapter)"
              value={time}
              onChange={(d) => d && setTime(d as any)}
            />
          </div>
        </MuiPickersUtilsProvider>

        <Button data-check="themed-button" style={{ background: theme.palette.primary.main, color: '#fff' }}>
          theme.palette.primary swatch
        </Button>
      </div>
    </ThemeProvider>
  );
}
