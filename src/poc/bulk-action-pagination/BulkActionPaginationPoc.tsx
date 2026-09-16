import * as React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { ThemeProvider, alpha } from '@mui/material/styles';

import { theme } from './theme';
import {
  EMPTY_FILTERS,
  type Employee,
  type Filters,
  type PublishStatus,
  TOTAL_EMPLOYEES,
  countMatching,
  describeFilters,
  fetchEmployees,
  resolveSelection,
  setPublishStatus,
} from './mockApi';
import {
  EMPTY_SELECTION,
  type SelectionState,
  buildPayload,
  pageCheckState,
  reduce,
  rowCheckState,
  scopeCoversCurrentFilter,
  selectedCount,
  shouldOfferSelectAll,
} from './selection';
import { SCENARIOS, type LogRow, type Scenario } from './scenarios';
import { EmployeeTable, FilterBar, fmt, type RowView } from './components';

/**
 * Prototype for "Problem: Assign Employee with paginated select-all in Add
 * Entitlement" (Notion, Ad Hoc Time Off FE), implementing the doc's Proposal:
 * one select-all, captured against the filter on screen, replaced wholesale by
 * the next one, with individual includes and excludes on top.
 *
 * The employee list is the Add Entitlement step-2 picker: 10,000 employees
 * behind a paginated, combinably-filtered endpoint that only ever returns one
 * page and a totalCount.
 */

const DEFAULT_PAGE_SIZE = 25;

export default function BulkActionPaginationPoc() {
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [selection, setSelection] = React.useState<SelectionState>(EMPTY_SELECTION);

  const [rows, setRows] = React.useState<Employee[]>([]);
  const [totalCount, setTotalCount] = React.useState(TOTAL_EMPLOYEES);
  const [loading, setLoading] = React.useState(true);

  const [pendingStatusId, setPendingStatusId] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);

  // --------------------------------------------------------------- fetching ---

  const requestId = React.useRef(0);
  React.useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetchEmployees(filters, page, pageSize).then((res) => {
      if (id !== requestId.current) return; // a newer request won
      setRows(res.employees);
      setTotalCount(res.totalCount);
      if (res.page !== page) setPage(res.page);
      setLoading(false);
    });
  }, [filters, page, pageSize]);

  // ---------------------------------------------------------------- derived ---

  const payload = React.useMemo(() => buildPayload(selection), [selection]);
  const count = selectedCount(selection);
  const resolvedCount = React.useMemo(() => resolveSelection(payload).size, [payload]);

  const rowViews: RowView[] = React.useMemo(
    () => rows.map((employee) => ({ employee, state: rowCheckState(selection, employee.id, filters) })),
    [rows, selection, filters],
  );

  const pageState = pageCheckState(rowViews.map((r) => r.state));
  const scope = selection.scope;
  const scopeIsCurrentFilter = scopeCoversCurrentFilter(selection, filters);
  const offerSelectAll = shouldOfferSelectAll(selection, pageState, totalCount, pageSize);
  const busy = running !== null;

  // ----------------------------------------------------------------- actions ---

  /** Appends one row in the column layout the doc's simulation tables use. */
  const appendLog = React.useCallback((action: string, atFilters: Filters, next: SelectionState) => {
    const nextPayload = buildPayload(next);
    setLog((prev) => [
      ...prev,
      {
        n: prev.length + 1,
        action,
        beReturn: `page: 1 · totalCount: ${fmt(countMatching(atFilters))}`,
        fePayload: formatPayload(nextPayload),
        uiCount: selectedCount(next),
        actualCount: resolveSelection(nextPayload).size,
      },
    ]);
  }, []);

  const apply = (next: SelectionState, action: string, atFilters: Filters) => {
    setSelection(next);
    appendLog(action, atFilters, next);
  };

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
    appendLog(`Filter — ${describeFilters(next)}`, next, selection);
  };

  const toggleRow = (id: string, checked: boolean) => {
    const next = reduce(selection, { type: 'toggle-row', id, selected: checked, underFilters: filters });
    apply(next, `${checked ? 'Include' : 'Exclude'} ${id}`, filters);
  };

  const togglePage = (checked: boolean) => {
    const ids = rows.map((r) => r.id);
    const next = reduce(selection, { type: 'toggle-page', ids, selected: checked, underFilters: filters });
    apply(next, `${checked ? 'Select' : 'Deselect'} the ${ids.length} rows on this page`, filters);
  };

  const selectAllMatching = () => {
    const replacing = selection.scope !== null;
    const next = reduce(selection, { type: 'select-all-matching', filters });
    apply(next, `Select all in "${describeFilters(filters)}" result`, filters);
    if (replacing) setToast('Previous select-all cleared — selecting all in the current filter');
  };

  const clearSelection = () => apply(reduce(selection, { type: 'clear' }), 'Clear selection', filters);

  /**
   * Publish / unpublish one row from its kebab menu. Patches the row in place
   * with what the backend returned rather than refetching the page: a refetch
   * would flash the whole table for a one-field change, and could shuffle rows
   * under a user who is midway through ticking them.
   */
  const changeStatus = async (id: string, status: PublishStatus) => {
    setPendingStatusId(id);
    try {
      const updated = await setPublishStatus(id, status);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setToast(`${updated.name} ${status === 'published' ? 'published' : 'unpublished'}`);
    } finally {
      setPendingStatusId(null);
    }
  };

  const resetAll = () => {
    setSelection(EMPTY_SELECTION);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setLog([]);
  };

  // --------------------------------------------------------------- scenarios ---

  /**
   * Replays a walkthrough from the doc against the live UI. State is threaded
   * through the loop by hand rather than read back from React, so each step
   * logs the state it produced instead of the state one render behind.
   */
  const runScenario = async (scenario: Scenario) => {
    setRunning(scenario.id);
    setSelection(EMPTY_SELECTION);
    setLog([]);
    setFilters(EMPTY_FILTERS);
    setPage(1);

    let sel = EMPTY_SELECTION;
    let current = EMPTY_FILTERS;
    await wait(400);

    for (const step of scenario.steps) {
      switch (step.kind) {
        case 'filter':
          current = step.filters;
          setFilters(current);
          setPage(1);
          break;
        case 'select-all':
          sel = reduce(sel, { type: 'select-all-matching', filters: current });
          break;
        case 'exclude-first-row': {
          const first = (await fetchEmployees(current, 1, pageSize)).employees[0];
          if (first) {
            sel = reduce(sel, { type: 'toggle-row', id: first.id, selected: false, underFilters: current });
          }
          break;
        }
      }
      setSelection(sel);
      appendLog(step.label, current, sel);
      await wait(1100);
    }
    setRunning(null);
  };

  // -------------------------------------------------------------------- view ---

  return (
    <ThemeProvider theme={theme}>
      <ScopedCssBaseline sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Prototype · Ad Hoc Time Off FE
              </Typography>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Add New Entitlement — Step 2: Assign employees
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: '84ch' }}>
                {fmt(TOTAL_EMPLOYEES)} employees behind a paginated, combinably-filtered endpoint.
                The browser is handed one page of {pageSize} rows and a <code>totalCount</code> —
                never the other {fmt(TOTAL_EMPLOYEES - pageSize)} — so select-all is sent as intent
                rather than as a list of ids. Select-all captures the filter on screen; clicking it
                again clears that and captures the new filter, so select-alls never stack. Includes
                and excludes sit on top.
              </Typography>
            </Box>

            <FilterBar filters={filters} onChange={changeFilters} disabled={busy} />

            <Paper
              variant="outlined"
              data-testid="selection-summary"
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                px: 2,
                py: 1.25,
                bgcolor: '#f4f6f8',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography component="span">
                  <Box component="span" sx={{ fontSize: 20, fontWeight: 700 }}>
                    {fmt(count)}
                  </Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {' '}
                    / {fmt(TOTAL_EMPLOYEES)} selected
                  </Box>
                </Typography>
                {scope ? (
                  <Typography variant="body2" color="text.secondary">
                    all of <b>{scope.label}</b> ({fmt(scope.total)})
                    {selection.exclude.length ? ` − ${selection.exclude.length} excluded` : ''}
                    {selection.include.length ? ` + ${selection.include.length} added` : ''}
                  </Typography>
                ) : null}
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={clearSelection} disabled={busy || count === 0}>
                  Clear selection
                </Button>
              </Stack>
            </Paper>

            {offerSelectAll ? (
              <Alert severity="info" variant="outlined" sx={{ justifyContent: 'center' }}>
                All {rows.length} employees on this page are selected.{' '}
                <Link component="button" type="button" onClick={selectAllMatching} disabled={busy}>
                  Select all {fmt(totalCount)} employees matching your filters
                </Link>
              </Alert>
            ) : null}

            {scope && scopeIsCurrentFilter ? (
              <Alert severity="success" variant="outlined">
                All {fmt(scope.total)} employees matching <b>{scope.label}</b> are selected
                {selection.exclude.length ? `, minus ${selection.exclude.length} excluded individually` : ''}.
              </Alert>
            ) : null}

            {scope && !scopeIsCurrentFilter ? (
              <Alert severity="warning" variant="outlined">
                <AlertTitle>Select-all is held against a different filter</AlertTitle>
                It captured <b>{scope.label}</b>, which is not what is on screen. The frontend holds
                that filter and its count, not the ids behind it, so it cannot say which of these
                rows the selection covers — their checkboxes are marked unknown.{' '}
                <Link component="button" type="button" onClick={selectAllMatching} disabled={busy}>
                  Select all {fmt(totalCount)} matching this filter instead
                </Link>{' '}
                — which clears the current select-all, per the proposal.
              </Alert>
            ) : null}

            <Box>
              <EmployeeTable
                rows={rowViews}
                loading={loading}
                pageState={pageState}
                disabled={busy}
                pendingStatusId={pendingStatusId}
                onToggleRow={toggleRow}
                onTogglePage={togglePage}
                onSetStatus={changeStatus}
              />
              <TablePagination
                component="div"
                count={totalCount}
                page={page - 1}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[10, 25, 50, 100]}
                onPageChange={(_, p) => setPage(p + 1)}
                onRowsPerPageChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                labelDisplayedRows={({ from, to, count: c }) => `${fmt(from)}–${fmt(to)} of ${fmt(c)}`}
                slotProps={{ actions: { nextButton: { disabled: busy || page >= Math.ceil(totalCount / pageSize) }, previousButton: { disabled: busy || page <= 1 } } }}
              />
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
                Payload the frontend would submit
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: '#0b1220',
                  color: '#d7e3ff',
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 260,
                }}
              >
                {JSON.stringify(payload, null, 2)}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The backend resolves this to {fmt(resolvedCount)} employee
                {resolvedCount === 1 ? '' : 's'}: everyone matching the captured filter, plus{' '}
                <code>include</code>, minus <code>exclude</code>. The UI shows {fmt(count)}
                {count === resolvedCount ? ' — the same number.' : ` — off by ${fmt(Math.abs(count - resolvedCount))}.`}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary" display="block">
                Replay the doc’s simulations
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                The three walkthroughs from the doc’s Problem Simulation section, driven through the
                controls above. Two of them are the sequences that miscounted when select-alls
                stacked.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                }}
              >
                {SCENARIOS.map((s) => (
                  <Paper key={s.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {s.docRef}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy}
                        onClick={() => runScenario(s)}
                      >
                        {running === s.id ? 'Running…' : 'Run'}
                      </Button>
                    </Stack>
                    <Typography variant="subtitle2">{s.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.expectation}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  Action log
                </Typography>
                {log.length ? (
                  <Link component="button" type="button" variant="body2" onClick={() => setLog([])}>
                    clear
                  </Link>
                ) : null}
              </Stack>
              {log.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Every action — filter, select-all, tick, untick — appends a row here, in the same
                  columns the doc’s simulation tables use.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>BE return</TableCell>
                        <TableCell>FE payload</TableCell>
                        <TableCell>Count in UI</TableCell>
                        <TableCell>Actually assigned</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {log.map((r) => {
                        const wrong = r.uiCount !== r.actualCount;
                        return (
                          <TableRow
                            key={r.n}
                            sx={wrong ? { bgcolor: (t) => alpha(t.palette.error.main, 0.08) } : undefined}
                          >
                            <TableCell sx={{ color: 'text.secondary' }}>{r.n}</TableCell>
                            <TableCell>{r.action}</TableCell>
                            <TableCell sx={MONO}>{r.beReturn}</TableCell>
                            <TableCell sx={MONO}>{r.fePayload}</TableCell>
                            <TableCell sx={MONO}>
                              {fmt(r.uiCount)} / {fmt(TOTAL_EMPLOYEES)}
                            </TableCell>
                            <TableCell sx={MONO}>
                              {fmt(r.actualCount)} {wrong ? '✗' : '✓'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Divider />

            <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
              <Button size="small" variant="outlined" onClick={resetAll} disabled={busy}>
                Reset prototype
              </Button>
              <Typography variant="body2" color="text.secondary">
                Mock backend, deterministic dataset, no network. Source:{' '}
                <code>src/poc/bulk-action-pagination/</code>
              </Typography>
            </Stack>
          </Stack>
        </Container>

        <Snackbar
          open={toast !== null}
          autoHideDuration={4000}
          onClose={() => setToast(null)}
          message={toast ?? ''}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        />
      </ScopedCssBaseline>
    </ThemeProvider>
  );
}

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, whiteSpace: 'pre-wrap' } as const;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Compact one-line rendering of the payload, for the log's narrow column. */
function formatPayload(p: ReturnType<typeof buildPayload>): string {
  if (!p.selectAll && p.include.length === 0) return '—';
  const parts: string[] = [];
  if (p.selectAll && p.filter) {
    parts.push('selectAll: true');
    parts.push(`filter: [${describeFilters(p.filter)}]`);
  }
  if (p.include.length) parts.push(`include: [${p.include.join(', ')}]`);
  if (p.exclude.length) parts.push(`exclude: [${p.exclude.join(', ')}]`);
  return parts.join('\n');
}
