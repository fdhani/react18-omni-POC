import * as React from 'react';
import { ThemeProvider, makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import Avatar from '@material-ui/core/Avatar';
import LinearProgress from '@material-ui/core/LinearProgress';
import Modal from '@material-ui/core/Modal';
import Backdrop from '@material-ui/core/Backdrop';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import CardHeader from '@material-ui/core/CardHeader';
import Icon from '@material-ui/core/Icon';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import MomentUtils from '@date-io/luxon';
import { MuiPickersUtilsProvider, KeyboardDatePicker, KeyboardTimePicker } from '@material-ui/pickers';
import { DateTime } from 'luxon';
import { theme, CUSTOM_HIGHLIGHT, ALERT_BG, AUTOCOMPLETE_BORDER, PAPER_BG, TOOLTIP_BG, AVATAR_BG, LINEAR_PROGRESS_BAR, MODAL_BACKDROP, STEPPER_BG } from './muiTheme';
import { MountTracker, libResults } from './ErrorBoundary';

/**
 * Tests the risk this investigation actually named for MUI v4 (section 6):
 * a customized theme (palette/breakpoints/shadows/typography/defaultProps),
 * JSS overrides for the 8 components it lists by name, JSS `$` conditional
 * selector composition, and the specific breaking-change API surface it
 * flagged by file count (labelWidth, GridList, gridGap, disableTypography,
 * fontSize="default"), plus the picker stack with a Luxon adapter
 * (approximating its "custom Luxon adapter" note) rather than a plain
 * default theme with uncustomized components.
 *
 * Unlike a visual check, this verifies via getComputedStyle that each
 * override actually took effect -- not just that nothing crashed -- and
 * checks JSS's own injected <style data-jss> sheets for the kind of
 * StrictMode-double-mount leak this investigation already found once in
 * react-sizeme (stack-grid repro): does JSS clean up its sheets correctly
 * on an unmount/remount, or does React 18 StrictMode leave duplicates or
 * gaps behind?
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

const useGridGap = makeStyles(() => ({
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gridGap: 12 },
  tile: { background: '#eee', height: 40 },
}));

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
      checkStyle('[data-check="paper"]', 'backgroundColor', PAPER_BG, 'MuiPaper override');
      checkStyle('.MuiTooltip-tooltip', 'backgroundColor', TOOLTIP_BG, 'MuiTooltip override');
      checkStyle('[data-check="avatar"]', 'backgroundColor', AVATAR_BG, 'MuiAvatar override');
      checkStyle('[data-check="progress"] .MuiLinearProgress-barColorPrimary', 'backgroundColor', LINEAR_PROGRESS_BAR, 'MuiLinearProgress override');
      checkStyle('.MuiBackdrop-root', 'backgroundColor', MODAL_BACKDROP, 'MuiBackdrop (Modal) override');
      checkStyle('[data-check="stepper"]', 'backgroundColor', STEPPER_BG, 'MuiStepper override');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MountTracker name="mui-theme" />

        <Alert data-check="alert" severity="success">
          Themed Alert (MuiAlert override)
        </Alert>

        <Autocomplete
          options={['One', 'Two', 'Three']}
          style={{ width: 240 }}
          renderInput={(params) => (
            <div data-check="autocomplete" ref={params.InputProps.ref as any} {...params}>
              <TextField {...params} label="Themed Autocomplete" size="small" />
            </div>
          )}
        />

        <Paper data-check="paper" style={{ padding: 12 }}>
          Themed Paper
        </Paper>

        <Tooltip title="Themed tooltip" open placement="right">
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
            the page below it -- also just more realistic usage. */}
        <button onClick={() => setModalOpen((o) => !o)}>Toggle Modal</button>
        <Modal open={modalOpen} BackdropComponent={Backdrop} onBackdropClick={() => setModalOpen(false)}>
          <Paper style={{ position: 'absolute', top: '20%', left: '20%', padding: 16 }}>
            Modal content (checking MuiBackdrop override)
          </Paper>
        </Modal>

        <Stepper data-check="stepper" activeStep={activeStep} onClick={() => setActiveStep((s) => (s + 1) % 3)}>
          <Step><StepLabel>Step 1</StepLabel></Step>
          <Step><StepLabel>Step 2</StepLabel></Step>
          <Step><StepLabel>Step 3</StepLabel></Step>
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

        <CardHeader disableTypography title={<h4 style={{ margin: 0 }}>disableTypography CardHeader</h4>} />

        <Icon fontSize="default">star</Icon>

        <div>
          <InputLabel htmlFor="labelwidth-demo">Manual labelWidth</InputLabel>
          <OutlinedInput data-check="labelwidth-input" id="labelwidth-demo" labelWidth={110} defaultValue="value" />
        </div>

        <MuiPickersUtilsProvider utils={MomentUtils}>
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

        <button data-check="themed-button" style={{ background: theme.palette.primary.main, color: '#fff', border: 0, padding: '8px 12px' }}>
          theme.palette.primary swatch
        </button>
      </div>
    </ThemeProvider>
  );
}
