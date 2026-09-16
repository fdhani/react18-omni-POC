import * as React from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
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

import { DEPARTMENTS, EMPLOYMENT_TYPES, LOCATIONS, type Employee, type Filters } from './mockApi';
import type { PageCheckState, RowCheckState } from './selection';

export const fmt = (n: number) => n.toLocaleString('en-US');

const UNKNOWN_HELP =
  'A select-all is in force for a different filter. The frontend holds that filter and its total count, not the list of ids behind it, so it cannot tell whether this row is inside the selection.';

/**
 * Row checkbox. `unknown` is the honest third state: shown indeterminate in
 * warning colour rather than as a confident tick, because the frontend really
 * does not know. Clicking it resolves the ambiguity by excluding the row.
 */
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
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
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
        <FilterGroup
          title="Employment type"
          options={EMPLOYMENT_TYPES}
          selected={filters.employmentTypes}
          disabled={disabled}
          onChange={(employmentTypes) => onChange({ ...filters, employmentTypes })}
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
        </Box>
      </Box>
    </Paper>
  );
}

export type RowView = {
  employee: Employee;
  state: RowCheckState;
};

export function EmployeeTable({
  rows,
  loading,
  pageState,
  disabled,
  onToggleRow,
  onTogglePage,
}: {
  rows: RowView[];
  loading: boolean;
  pageState: PageCheckState;
  disabled?: boolean;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
}) {
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
            <TableCell>Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && !loading ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
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
                  {employee.id} · {employee.jobTitle}
                </Typography>
              </TableCell>
              <TableCell>{employee.department}</TableCell>
              <TableCell>{employee.location}</TableCell>
              <TableCell>{employee.employmentType}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
