import * as React from 'react';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Pagination from '@material-ui/lab/Pagination';
import Rating from '@material-ui/lab/Rating';
import Skeleton from '@material-ui/lab/Skeleton';
import TextField from '@material-ui/core/TextField';
import { MountTracker } from './ErrorBoundary';

const OPTIONS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

// @material-ui/lab@4's Autocomplete predates v5's rewrite and is one of the
// more ref/focus-management-heavy components in the v4 ecosystem -- a
// plausible candidate for React 18 ref-timing issues.
export default function MuiLabDemo() {
  const [value, setValue] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<number | null>(2);

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }} data-demo="mui-lab">
      <MountTracker name="mui-lab" />
      <Autocomplete
        options={OPTIONS}
        style={{ width: 220 }}
        value={value}
        onChange={(_, v) => setValue(v)}
        renderInput={(params) => <TextField {...params} label="Autocomplete" size="small" />}
      />
      <Pagination count={5} />
      <Rating name="demo-rating" value={rating} onChange={(_, v) => setRating(v)} />
      <Skeleton variant="text" width={120} />
      <Skeleton variant="circle" width={32} height={32} />
    </div>
  );
}
