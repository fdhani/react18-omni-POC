import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import TextField from '@material-ui/core/TextField';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { MuiPickersUtilsProvider, KeyboardDatePicker } from '@material-ui/pickers';
import LuxonUtils from '@date-io/luxon';
import { DateTime } from 'luxon';
import { MountTracker, libResults } from './ErrorBoundary';

const OPTIONS = ['Alpha', 'Bravo', 'Charlie'];

/**
 * The plain ReactHookFormDemo tests react-hook-form@6's uncontrolled
 * register() pattern. Given MUI is used in 2,431 files and RHF in 788 in
 * the real app, the realistic integration point is almost certainly RHF's
 * Controller wrapping MUI's *controlled* inputs (TextField, Select,
 * Autocomplete, the date pickers) -- a materially different code path from
 * register(), and untested until now.
 *
 * react-hook-form@6's Controller has a different render-prop signature than
 * v7's: `render={(field, state) => ...}` where `field` is directly
 * spreadable (onChange/onBlur/value/name/ref), not nested under a `field`
 * key as in v7 (`render={({ field }) => ...}`). This is one concrete,
 * verifiable instance of the "breaking v6-to-v7 API migration" the
 * dependency-upgrade investigation names -- the two versions are not
 * drop-in compatible at this call site.
 */
type FormValues = {
  name: string;
  color: string;
  autoValue: string | null;
  date: DateTime;
};

export default function ReactHookFormControllerDemo() {
  // No generic type argument: react-hook-form is untyped here under this
  // project's moduleResolution (see src/types.d.ts).
  const { control, handleSubmit, formState } = useForm({
    defaultValues: { name: '', color: 'red', autoValue: null, date: DateTime.local() } as FormValues,
  });
  const [submitted, setSubmitted] = React.useState<string | null>(null);

  React.useEffect(() => {
    const r = libResults['rhf-controller'];
    if (r) r.notes.push(`formState.errors accessible: ${typeof formState.errors === 'object'}`);
  }, [formState]);

  return (
    <form
      data-demo="rhf-controller"
      onSubmit={handleSubmit((data: any) => setSubmitted(JSON.stringify({ ...data, date: data.date?.toISODate?.() })))}
      style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <MountTracker name="rhf-controller" />

      <Controller
        name="name"
        control={control}
        rules={{ required: true }}
        render={(field: any) => <TextField {...field} label="Name (Controller + TextField)" size="small" data-check="rhf-textfield" />}
      />

      <Controller
        name="color"
        control={control}
        render={(field: any) => (
          <Select {...field} data-check="rhf-select">
            <MenuItem value="red">Red</MenuItem>
            <MenuItem value="blue">Blue</MenuItem>
          </Select>
        )}
      />

      <Controller
        name="autoValue"
        control={control}
        render={(field: any) => (
          <Autocomplete
            options={OPTIONS}
            style={{ width: 200 }}
            value={field.value}
            onChange={(_, v) => field.onChange(v)}
            renderInput={(params) => <TextField {...params} label="Controller + Autocomplete" size="small" data-check="rhf-autocomplete" />}
          />
        )}
      />

      <MuiPickersUtilsProvider utils={LuxonUtils}>
        <Controller
          name="date"
          control={control}
          render={(field: any) => (
            <KeyboardDatePicker
              label="Controller + KeyboardDatePicker"
              value={field.value}
              onChange={(d: any) => field.onChange(d)}
              format="yyyy-MM-dd"
              data-check="rhf-datepicker"
            />
          )}
        />
      </MuiPickersUtilsProvider>

      <button type="submit" data-check="rhf-submit">
        Submit
      </button>
      {submitted && <span data-submitted-controller>{submitted}</span>}
    </form>
  );
}
