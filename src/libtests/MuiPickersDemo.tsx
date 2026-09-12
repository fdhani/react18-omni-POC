import * as React from 'react';
import MomentUtils from '@date-io/moment';
import { MuiPickersUtilsProvider, DatePicker, DateTimePicker, TimePicker } from '@material-ui/pickers';
import moment from 'moment';
import { MountTracker } from './ErrorBoundary';

// @material-ui/pickers v3 is unmaintained (superseded by @mui/x-date-pickers)
// and predates React 18 entirely -- its peer range only goes to ^17.0.0. Of
// everything in this smoke test, this is the single highest-risk package.
export default function MuiPickersDemo() {
  const [date, setDate] = React.useState(moment());
  const [dt, setDt] = React.useState(moment());
  const [time, setTime] = React.useState(moment());

  return (
    <MuiPickersUtilsProvider utils={MomentUtils}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }} data-demo="mui-pickers">
        <MountTracker name="mui-pickers" />
        <DatePicker label="Date" value={date} onChange={(d) => d && setDate(d)} />
        <DateTimePicker label="Date+Time" value={dt} onChange={(d) => d && setDt(d)} />
        <TimePicker label="Time" value={time} onChange={(d) => d && setTime(d)} />
      </div>
    </MuiPickersUtilsProvider>
  );
}
