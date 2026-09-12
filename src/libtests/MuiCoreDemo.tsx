import * as React from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import Snackbar from '@material-ui/core/Snackbar';
import Drawer from '@material-ui/core/Drawer';
import Tooltip from '@material-ui/core/Tooltip';
import Menu from '@material-ui/core/Menu';
import { makeStyles } from '@material-ui/core/styles';
import { MountTracker } from './ErrorBoundary';

// Exercises the Popper/Portal-based components (Tooltip, Select, Menu, Dialog,
// Drawer) that internally use findDOMNode / ref-forwarding patterns most likely
// to be sensitive to React 18's stricter ref semantics under StrictMode.
const useStyles = makeStyles(() => ({ root: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } }));

export default function MuiCoreDemo() {
  const classes = useStyles();
  const [select, setSelect] = React.useState('a');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [snackOpen, setSnackOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  return (
    <div className={classes.root} data-demo="mui-core">
      <MountTracker name="mui-core" />
      <Button variant="contained" color="primary" onClick={() => setDialogOpen(true)}>
        Open Dialog
      </Button>
      <Button variant="outlined" onClick={(e) => setAnchorEl(e.currentTarget)}>
        Open Menu
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>Item 1</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Item 2</MenuItem>
      </Menu>
      <Tooltip title="A Popper-based tooltip">
        <Button onClick={() => setSnackOpen(true)}>Show Snackbar</Button>
      </Tooltip>
      <TextField label="Text field" size="small" defaultValue="hello" />
      <Select value={select} onChange={(e) => setSelect(e.target.value as string)}>
        <MenuItem value="a">A</MenuItem>
        <MenuItem value="b">B</MenuItem>
      </Select>
      <Button onClick={() => setDrawerOpen(true)}>Open Drawer</Button>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>MUI v4 Dialog</DialogTitle>
        <DialogContent>Renders in a Portal via ReactDOM.createPortal + findDOMNode.</DialogContent>
      </Dialog>
      <Snackbar
        open={snackOpen}
        autoHideDuration={1500}
        onClose={() => setSnackOpen(false)}
        message="Snackbar via Portal"
      />
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div style={{ width: 200, padding: 16 }}>Drawer content</div>
      </Drawer>
    </div>
  );
}
