import * as React from 'react';
import LuxonUtils from '@date-io/luxon';
import { MuiPickersUtilsProvider, DatePicker, DateTimePicker, TimePicker } from '@material-ui/pickers';
import { DateTime } from 'luxon';
import { MountTracker } from './ErrorBoundary';

// @material-ui/pickers v3 is unmaintained (superseded by @mui/x-date-pickers)
// and predates React 18 entirely -- its peer range only goes to ^17.0.0. Of
// everything in this smoke test, this is the single highest-risk package.
//
// Uses a Luxon adapter (not Moment) to match the investigation's note that
// the real app's picker stack uses "a custom Luxon adapter of roughly 350
// lines" -- also required technically: @material-ui/pickers v3's typings tie
// the whole TypeScript program to a single date-library adapter, so this and
// MuiThemeDemo.tsx (which also uses pickers) must agree on Luxon rather than
// mixing adapters.
export default function MuiPickersDemo() {
  const [date, setDate] = React.useState(DateTime.local());
  const [dt, setDt] = React.useState(DateTime.local());
  const [time, setTime] = React.useState(DateTime.local());

  return (
    <MuiPickersUtilsProvider utils={LuxonUtils}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }} data-demo="mui-pickers">
        <MountTracker name="mui-pickers" />
        <DatePicker label="Date" value={date} onChange={(d) => d && setDate(d as any)} />
        <DateTimePicker label="Date+Time" value={dt} onChange={(d) => d && setDt(d as any)} />
        <TimePicker label="Time" value={time} onChange={(d) => d && setTime(d as any)} />
      </div>
    </MuiPickersUtilsProvider>
  );
}
