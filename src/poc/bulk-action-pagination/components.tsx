import * as React from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/UnpublishedOutlined';

import {
  DEPARTMENTS,
  LOCATIONS,
  type EmployeeRow,
  type Filters,
  type FormStatus,
} from './mockApi';
import type { PageCheckState, RowCheckState } from './selection';

export const fmt = (n: number) => n.toLocaleString('en-US');

const UNKNOWN_HELP =
  'A select-all is in force for a different filter. The frontend holds that filter and its total count, not the list of ids behind it, so it cannot tell whether this row is inside the selection.';

export function RowCheckbox({
  state,
  onChange,
  label,
  disabled,
}: {
  state: RowCheckState;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  if (state === 'unknown') {
    return (
      <Tooltip title={UNKNOWN_HELP}>
        <span>
          <Checkbox
            indeterminate
            color="warning"
            size="small"
            disabled={disabled}
            inputProps={{ 'aria-label': `${label} — selection unknown to the frontend` }}
            onChange={() => onChange(false)}
          />
        </span>
      </Tooltip>
    );
  }
  return (
    <Checkbox
      size="small"
      checked={state === 'checked'}
      disabled={disabled}
      inputProps={{ 'aria-label': label }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

// ------------------------------------------------------------ status of a row ---

const STATUS_LABEL: Record<FormStatus, string> = {
  not_generated: 'Not generated',
  missing_info: 'Missing info',
  unpublished: 'Unpublished',
  published: 'Published',
};

export function StatusChip({ row }: { row: EmployeeRow }) {
  if (row.status === 'missing_info') {
    return (
      <Tooltip title={`Missing: ${row.missingFields.join(', ')}`}>
        <Chip size="small" color="warning" variant="outlined" label={STATUS_LABEL.missing_info} />
      </Tooltip>
    );
  }
  return (
    <Chip
      size="small"
      label={STATUS_LABEL[row.status]}
      color={row.status === 'published' ? 'success' : 'default'}
      variant={row.status === 'published' ? 'filled' : 'outlined'}
    />
  );
}

/**
 * The one action a row can take, and why it cannot take one.
 *
 * Publishing is only possible for a generated, complete, unpublished form
 * (PH-BIR-06.1). Rather than offering a Publish that fails, the menu item is
 * disabled and carries the reason.
 */
export function rowAction(row: EmployeeRow):
  | { kind: 'publish'; enabled: true }
  | { kind: 'unpublish'; enabled: true }
  | { kind: 'publish'; enabled: false; reason: string } {
  switch (row.status) {
    case 'published':
      return { kind: 'unpublish', enabled: true };
    case 'unpublished':
      return { kind: 'publish', enabled: true };
    case 'missing_info':
      return { kind: 'publish', enabled: false, reason: `Missing ${row.missingFields.join(', ')}` };
    case 'not_generated':
    default:
      return { kind: 'publish', enabled: false, reason: 'Form not generated for this tax year' };
  }
}

// ------------------------------------------------------------------- filters ---

function FilterGroup({
  title,
  options,
  selected,
  onChange,
  disabled,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" display="block">
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <Chip
              key={o}
              label={o}
              size="small"
              clickable
              disabled={disabled}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

export function FilterBar({
  filters,
  onChange,
  disabled,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  disabled?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}
      >
        <FilterGroup
          title="Department"
          options={DEPARTMENTS}
          selected={filters.departments}
          disabled={disabled}
          onChange={(departments) => onChange({ ...filters, departments })}
        />
        <FilterGroup
          title="Location"
          options={LOCATIONS}
          selected={filters.locations}
          disabled={disabled}
          onChange={(locations) => onChange({ ...filters, locations })}
        />
        <Box>
          <Typography variant="overline" color="text.secondary" display="block">
            Search
          </Typography>
          <TextField
            size="small"
            fullWidth
            type="search"
            placeholder="Name or email"
            value={filters.search}
            disabled={disabled}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={
              <Switch
                size="small"
                checked={filters.missingInfoOnly}
                disabled={disabled}
                onChange={(e) => onChange({ ...filters, missingInfoOnly: e.target.checked })}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                Missing info only
              </Typography>
            }
          />
        </Box>
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------- table ---

export type RowView = {
  employee: EmployeeRow;
  state: RowCheckState;
};

export function EmployeeTable({
  rows,
  loading,
  pageState,
  disabled,
  pendingRowId,
  onToggleRow,
  onTogglePage,
  onSetPublished,
}: {
  rows: RowView[];
  loading: boolean;
  pageState: PageCheckState;
  disabled?: boolean;
  pendingRowId: string | null;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  onSetPublished: (id: string, published: boolean) => void;
}) {
  // One menu for the table, re-anchored per row: 25 mounted popovers for the
  // one that can be open at a time would be waste.
  const [menu, setMenu] = React.useState<{ anchor: HTMLElement; row: EmployeeRow } | null>(null);
  const closeMenu = () => setMenu(null);
  const action = menu ? rowAction(menu.row) : null;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ position: 'relative' }}>
      {loading ? <LinearProgress sx={{ position: 'absolute', inset: '0 0 auto', height: 2 }} /> : null}
      <Table size="small" sx={{ '& tbody': { opacity: loading ? 0.45 : 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                size="small"
                checked={pageState === 'all'}
                indeterminate={pageState === 'some'}
                disabled={disabled}
                inputProps={{ 'aria-label': 'Select all employees on this page' }}
                onChange={(e) => onTogglePage(pageState === 'some' ? true : e.target.checked)}
              />
            </TableCell>
            <TableCell>Employee</TableCell>
            <TableCell>Department</TableCell>
            <TableCell>Location</TableCell>
            <TableCell>TIN</TableCell>
            <TableCell>Form status</TableCell>
            <TableCell align="right" sx={{ width: 56 }}>
              <Box component="span" sx={visuallyHidden}>
                Actions
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && !loading ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                No employees match these filters.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map(({ employee, state }) => (
            <TableRow
              key={employee.id}
              hover
              selected={state === 'checked'}
              sx={
                state === 'unknown'
                  ? { bgcolor: (t) => alpha(t.palette.warning.main, 0.07) }
                  : undefined
              }
            >
              <TableCell padding="checkbox">
                <RowCheckbox
                  state={state}
                  disabled={disabled}
                  label={`Select ${employee.name}`}
                  onChange={(checked) => onToggleRow(employee.id, checked)}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>
                  {employee.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {employee.id}
                </Typography>
              </TableCell>
              <TableCell>{employee.department}</TableCell>
              <TableCell>{employee.location}</TableCell>
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {employee.tin ?? <Typography variant="caption" color="warning.main">missing</Typography>}
              </TableCell>
              <TableCell>
                <StatusChip row={employee} />
              </TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  disabled={disabled || pendingRowId === employee.id}
                  aria-label={`Actions for ${employee.name}`}
                  aria-haspopup="menu"
                  onClick={(e) => setMenu({ anchor: e.currentTarget, row: employee })}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Menu anchorEl={menu?.anchor ?? null} open={menu !== null} onClose={closeMenu}>
        {menu && action ? (
          <MenuItem
            disabled={!action.enabled}
            onClick={() => {
              onSetPublished(menu.row.id, action.kind === 'publish');
              closeMenu();
            }}
          >
            <ListItemIcon>
              {action.kind === 'publish' ? (
                <PublishIcon fontSize="small" />
              ) : (
                <UnpublishedIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={action.kind === 'publish' ? 'Publish' : 'Unpublish'}
              secondary={action.enabled ? undefined : action.reason}
            />
          </MenuItem>
        ) : null}
      </Menu>
    </TableContainer>
  );
}
