import * as React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThemeProvider, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { theme } from './theme';
import {
  EMPTY_FILTERS,
  type BulkResult,
  type EmployeeRow,
  type Filters,
  type PublishAction,
  type SelectionSummary,
  TAX_YEARS,
  TOTAL_EMPLOYEES,
  type TaxYear,
  bulkSetPublished,
  countMatching,
  describeFilters,
  fetchEmployees,
  generateForms,
  isGenerated,
  resetForms,
  resolveSelection,
  selectionSummary,
  setPublished,
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
 * Prototype: bulk publish / unpublish over a paginated, filtered employee list.
 *
 * Feature: [PH-BIR-01..07] BIR 2316 Tax form generation — the employee table
 * for a tax year, where an admin publishes forms so employees can see them.
 *
 * Selection follows the Proposal in "Problem: Assign Employee with paginated
 * select-all in Add Entitlement": one select-all, captured against the filter
 * on screen and replaced by the next one, with includes and excludes on top.
 * The browser only ever holds one page, so the selection travels as intent.
 *
 * The bulk actions then run into a second problem the selection model does not
 * solve. Publish only applies to a form that is generated, complete and not yet
 * published (PH-BIR-06.1), and the frontend cannot count those: it holds a
 * filter and a total, not the statuses of rows it has never fetched. So the
 * eligible counts come from the backend, and they are shown in the menu itself
 * rather than discovered after the fact.
 */

const DEFAULT_PAGE_SIZE = 25;

export default function BulkActionPaginationPoc() {
  const [taxYear, setTaxYear] = React.useState<TaxYear>(TAX_YEARS[0]);
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [selection, setSelection] = React.useState<SelectionState>(EMPTY_SELECTION);

  const [rows, setRows] = React.useState<EmployeeRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [generated, setGenerated] = React.useState(() => isGenerated(TAX_YEARS[0]));

  const [summary, setSummary] = React.useState<SelectionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [bulkMenu, setBulkMenu] = React.useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = React.useState<PublishAction | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<BulkResult | null>(null);

  const [pendingRowId, setPendingRowId] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);

  // --------------------------------------------------------------- fetching ---

  const requestId = React.useRef(0);
  React.useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetchEmployees(taxYear, filters, page, pageSize).then((res) => {
      if (id !== requestId.current) return; // a newer request won
      setRows(res.employees);
      setTotalCount(res.totalCount);
      if (res.page !== page) setPage(res.page);
      setLoading(false);
    });
  }, [taxYear, filters, page, pageSize, reload]);

  // ---------------------------------------------------------------- derived ---

  const payload = React.useMemo(() => buildPayload(selection), [selection]);
  const count = selectedCount(selection);
  const resolvedCount = React.useMemo(
    () => resolveSelection(payload, taxYear).size,
    [payload, taxYear],
  );

  /**
   * The eligible counts, refreshed whenever the selection changes. Debounced,
   * because a run of checkbox ticks should not be a run of round trips.
   */
  React.useEffect(() => {
    if (count === 0) {
      setSummary(null);
      return;
    }
    let live = true;
    setSummaryLoading(true);
    const id = setTimeout(() => {
      selectionSummary(payload, taxYear).then((s) => {
        if (!live) return;
        setSummary(s);
        setSummaryLoading(false);
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [payload, taxYear, count, reload]);

  const rowViews: RowView[] = React.useMemo(
    () => rows.map((employee) => ({ employee, state: rowCheckState(selection, employee.id, filters) })),
    [rows, selection, filters],
  );

  const pageState = pageCheckState(rowViews.map((r) => r.state));
  const scope = selection.scope;
  const scopeIsCurrentFilter = scopeCoversCurrentFilter(selection, filters);
  const offerSelectAll = shouldOfferSelectAll(selection, pageState, totalCount, pageSize);
  const busy = running !== null || applying;

  // ----------------------------------------------------------------- logging ---

  const appendLog = React.useCallback(
    (action: string, atFilters: Filters, next: SelectionState, year: TaxYear, note?: string) => {
      const nextPayload = buildPayload(next);
      setLog((prev) => [
        ...prev,
        {
          n: prev.length + 1,
          action,
          beReturn: note ?? `page: 1 · totalCount: ${fmt(countMatching(atFilters, year))}`,
          fePayload: formatPayload(nextPayload),
          uiCount: selectedCount(next),
          actualCount: resolveSelection(nextPayload, year).size,
        },
      ]);
    },
    [],
  );

  const apply = (next: SelectionState, action: string, atFilters: Filters) => {
    setSelection(next);
    appendLog(action, atFilters, next, taxYear);
  };

  // ----------------------------------------------------------------- actions ---

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
    appendLog(`Filter — ${describeFilters(next)}`, next, selection, taxYear);
  };

  /** A different tax year is a different set of forms, so the selection cannot carry over. */
  const changeTaxYear = (year: TaxYear) => {
    setTaxYear(year);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setSelection(EMPTY_SELECTION);
    setLastResult(null);
    setGenerated(isGenerated(year));
    setLog([]);
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
    const next = reduce(selection, { type: 'select-all-matching', filters, year: taxYear });
    apply(next, `Select all in "${describeFilters(filters)}" result`, filters);
    if (replacing) setToast('Previous select-all cleared — selecting all in the current filter');
  };

  const clearSelection = () => apply(reduce(selection, { type: 'clear' }), 'Clear selection', filters);

  const changeRowPublished = async (id: string, published: boolean) => {
    setPendingRowId(id);
    try {
      const updated = await setPublished(id, taxYear, published);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setReload((n) => n + 1); // the selection summary depends on statuses
      setToast(`${updated.name} ${published ? 'published' : 'unpublished'}`);
    } finally {
      setPendingRowId(null);
    }
  };

  /**
   * Run the bulk action. The backend decides eligibility at execution time
   * against live state, so the preview count is a forecast, not a promise —
   * what comes back is what actually happened.
   */
  const runBulk = async (action: PublishAction) => {
    setConfirming(null);
    setApplying(true);
    try {
      const result = await bulkSetPublished(payload, taxYear, action);
      setLastResult(result);
      appendLog(
        `Bulk ${action} on the selection`,
        filters,
        selection,
        taxYear,
        `affected: ${fmt(result.affected)} · skipped: ${fmt(
          result.skippedAlreadyInState + result.skippedMissingInfo + result.skippedNotGenerated,
        )}`,
      );
      // The captured filter no longer describes the same rows once statuses move.
      setSelection(EMPTY_SELECTION);
      setReload((n) => n + 1);
    } finally {
      setApplying(false);
    }
  };

  const runGenerate = async () => {
    setApplying(true);
    try {
      await generateForms(taxYear);
      setGenerated(true);
      setSelection(EMPTY_SELECTION);
      setLastResult(null);
      setReload((n) => n + 1);
      setToast(`Forms generated for ${taxYear}`);
    } finally {
      setApplying(false);
    }
  };

  const runReset = async () => {
    setApplying(true);
    try {
      await resetForms(taxYear);
      setGenerated(false);
      setSelection(EMPTY_SELECTION);
      setLastResult(null);
      setReload((n) => n + 1);
      setToast(`All ${taxYear} forms deleted`);
    } finally {
      setApplying(false);
    }
  };

  const showMissingInfo = () => {
    setBulkMenu(null);
    changeFilters({ ...filters, missingInfoOnly: true });
  };

  // --------------------------------------------------------------- scenarios ---

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
          sel = reduce(sel, { type: 'select-all-matching', filters: current, year: taxYear });
          break;
        case 'exclude-first-row': {
          const first = (await fetchEmployees(taxYear, current, 1, pageSize)).employees[0];
          if (first) {
            sel = reduce(sel, { type: 'toggle-row', id: first.id, selected: false, underFilters: current });
          }
          break;
        }
      }
      setSelection(sel);
      appendLog(step.label, current, sel, taxYear);
      await wait(1100);
    }
    setRunning(null);
  };

  // -------------------------------------------------------------------- view ---

  const blockedInSelection = summary ? summary.missingInfo + summary.notGenerated : 0;

  return (
    <ThemeProvider theme={theme}>
      <ScopedCssBaseline sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Prototype · Tax Form · PH-BIR-01 to 07
              </Typography>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                BIR 2316 — Generate and publish tax forms
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: '86ch' }}>
                {fmt(TOTAL_EMPLOYEES)} employees for the tax year, behind a paginated endpoint that
                hands the browser one page of {pageSize} rows and a <code>totalCount</code>. Select-all
                therefore travels as a filter, not as a list of ids — and because publish only applies
                to a form that is generated, complete and not yet published, the eligible counts have
                to come from the backend. They are in the bulk menu, before you commit.
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
                <TextField
                  select
                  size="small"
                  label="Tax year"
                  value={taxYear}
                  disabled={busy}
                  onChange={(e) => changeTaxYear(Number(e.target.value) as TaxYear)}
                  SelectProps={{ native: true }}
                  sx={{ width: 130 }}
                >
                  {TAX_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </TextField>
                <Box sx={{ flex: 1 }} />
                {generated ? (
                  <Button size="small" color="error" disabled={busy} onClick={runReset}>
                    Reset all
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy || generated}
                  onClick={runGenerate}
                >
                  {generated ? 'Forms generated' : 'Generate forms'}
                </Button>
              </Stack>
            </Paper>

            {!generated ? (
              <Alert severity="info" variant="outlined">
                No forms exist for {taxYear} yet. Generate them to publish — publishing a form is what
                makes it visible to the employee under Profile → Documents → Payroll Documents.
              </Alert>
            ) : null}

            {lastResult ? (
              <Alert
                severity={lastResult.affected > 0 ? 'success' : 'warning'}
                variant="outlined"
                onClose={() => setLastResult(null)}
              >
                <AlertTitle>
                  {fmt(lastResult.affected)} form{lastResult.affected === 1 ? '' : 's'}{' '}
                  {lastResult.action === 'publish' ? 'published' : 'unpublished'}
                </AlertTitle>
                {describeSkips(lastResult)}
              </Alert>
            ) : null}

            <FilterBar filters={filters} onChange={changeFilters} disabled={busy} />

            <Paper
              variant="outlined"
              data-testid="selection-summary"
              sx={{ position: 'sticky', top: 0, zIndex: 5, px: 2, py: 1.25, bgcolor: '#f4f6f8' }}
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
                <Button
                  size="small"
                  variant="contained"
                  endIcon={<ExpandMoreIcon />}
                  disabled={busy || count === 0}
                  aria-haspopup="menu"
                  onClick={(e) => setBulkMenu(e.currentTarget)}
                >
                  Bulk actions
                </Button>
                <Button size="small" onClick={clearSelection} disabled={busy || count === 0}>
                  Clear
                </Button>
              </Stack>
            </Paper>

            {/* Counts live in the menu, so "publish only acts on unpublished" is
                visible before clicking rather than explained afterwards. */}
            <Menu anchorEl={bulkMenu} open={bulkMenu !== null} onClose={() => setBulkMenu(null)}>
              <MenuItem
                disabled={summaryLoading || !summary || summary.publishable === 0}
                onClick={() => {
                  setBulkMenu(null);
                  setConfirming('publish');
                }}
              >
                <ListItemText
                  primary="Publish"
                  secondary={
                    summaryLoading || !summary
                      ? 'counting…'
                      : summary.publishable === 0
                        ? 'nothing to publish in this selection'
                        : `${fmt(summary.publishable)} unpublished`
                  }
                />
              </MenuItem>
              <MenuItem
                disabled={summaryLoading || !summary || summary.unpublishable === 0}
                onClick={() => {
                  setBulkMenu(null);
                  setConfirming('unpublish');
                }}
              >
                <ListItemText
                  primary="Unpublish"
                  secondary={
                    summaryLoading || !summary
                      ? 'counting…'
                      : summary.unpublishable === 0
                        ? 'nothing published in this selection'
                        : `${fmt(summary.unpublishable)} published`
                  }
                />
              </MenuItem>
              {blockedInSelection > 0 ? (
                <Box sx={{ px: 2, py: 1, maxWidth: 320, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">
                    {fmt(blockedInSelection)} selected form
                    {blockedInSelection === 1 ? '' : 's'}{' '}
                    {summary && summary.notGenerated > 0 && summary.missingInfo > 0
                      ? 'cannot be published — missing information or not generated'
                      : summary && summary.notGenerated > 0
                        ? 'have not been generated yet'
                        : 'cannot be published — missing information'}
                    .
                  </Typography>
                  {summary && summary.missingInfo > 0 ? (
                    <Button size="small" sx={{ mt: 0.5, ml: -1 }} onClick={showMissingInfo}>
                      Show them
                    </Button>
                  ) : null}
                </Box>
              ) : null}
            </Menu>

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
                that filter and its count, not the ids behind it, so it cannot say which of these rows
                the selection covers — their checkboxes are marked unknown.{' '}
                <Link component="button" type="button" onClick={selectAllMatching} disabled={busy}>
                  Select all {fmt(totalCount)} matching this filter instead
                </Link>{' '}
                — which clears the current select-all.
              </Alert>
            ) : null}

            <Box>
              <EmployeeTable
                rows={rowViews}
                loading={loading}
                pageState={pageState}
                disabled={busy}
                pendingRowId={pendingRowId}
                onToggleRow={toggleRow}
                onTogglePage={togglePage}
                onSetPublished={changeRowPublished}
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
                  maxHeight: 240,
                }}
              >
                {JSON.stringify({ taxYear, ...payload }, null, 2)}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The backend resolves this to {fmt(resolvedCount)} employee
                {resolvedCount === 1 ? '' : 's'}, and the UI shows {fmt(count)}
                {count === resolvedCount ? ' — the same number.' : ` — off by ${fmt(Math.abs(count - resolvedCount))}.`}{' '}
                Of those,{' '}
                {summary
                  ? `${fmt(summary.publishable)} can be published and ${fmt(summary.unpublishable)} can be unpublished`
                  : 'the eligible counts come from a separate call'}{' '}
                — a breakdown the frontend has no way to compute for rows it has never fetched.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary" display="block">
                Replay the select-all simulations
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                The three walkthroughs from the Problem Simulation section of the select-all doc,
                driven through the controls above. Two of them are the sequences that miscounted when
                select-alls stacked.
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
                      <Button size="small" variant="contained" disabled={busy} onClick={() => runScenario(s)}>
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
                  Every action — filter, select-all, tick, untick, bulk publish — appends a row here.
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
                        <TableCell>Resolved</TableCell>
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
                            <TableCell sx={MONO}>{fmt(r.uiCount)}</TableCell>
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
            <Typography variant="body2" color="text.secondary">
              Mock backend, deterministic dataset, no network. Source:{' '}
              <code>src/poc/bulk-action-pagination/</code>
            </Typography>
          </Stack>
        </Container>

        <Dialog open={confirming !== null} onClose={() => setConfirming(null)}>
          <DialogTitle>
            {confirming === 'publish'
              ? `Publish ${fmt(summary?.publishable ?? 0)} form${summary?.publishable === 1 ? '' : 's'}?`
              : `Unpublish ${fmt(summary?.unpublishable ?? 0)} form${summary?.unpublishable === 1 ? '' : 's'}?`}
          </DialogTitle>
          <DialogContent>
            <DialogContentText component="div">
              {confirming === 'publish' ? (
                <>
                  <p style={{ marginTop: 0 }}>
                    Employees will be able to see their BIR 2316 form, and a published form cannot be
                    edited until it is unpublished again.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>{fmt(summary?.publishable ?? 0)} will be published</li>
                    {summary && summary.unpublishable > 0 ? (
                      <li>
                        {fmt(summary.unpublishable)} {isAre(summary.unpublishable)} already published
                        — skipped
                      </li>
                    ) : null}
                    {summary && summary.missingInfo > 0 ? (
                      <li>
                        {fmt(summary.missingInfo)} {isAre(summary.missingInfo)} missing information —
                        skipped
                      </li>
                    ) : null}
                    {summary && summary.notGenerated > 0 ? (
                      <li>
                        {fmt(summary.notGenerated)} {summary.notGenerated === 1 ? 'has' : 'have'} no
                        form for {taxYear} — skipped
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0 }}>
                    Employees will lose access to their BIR 2316 form. The form itself is kept and can
                    be published again.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>{fmt(summary?.unpublishable ?? 0)} will be unpublished</li>
                    {summary && summary.total - summary.unpublishable > 0 ? (
                      <li>
                        {fmt(summary.total - summary.unpublishable)}{' '}
                        {isAre(summary.total - summary.unpublishable)} not published — skipped
                      </li>
                    ) : null}
                  </ul>
                </>
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              variant="contained"
              color={confirming === 'unpublish' ? 'warning' : 'primary'}
              onClick={() => confirming && runBulk(confirming)}
            >
              {confirming === 'publish' ? 'Publish' : 'Unpublish'}
            </Button>
          </DialogActions>
        </Dialog>

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

const MONO = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
} as const;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isAre = (n: number) => (n === 1 ? 'is' : 'are');

function describeSkips(r: BulkResult): string {
  const parts: string[] = [];
  if (r.skippedAlreadyInState) {
    parts.push(
      `${fmt(r.skippedAlreadyInState)} already ${r.action === 'publish' ? 'published' : 'unpublished'}`,
    );
  }
  if (r.skippedMissingInfo) parts.push(`${fmt(r.skippedMissingInfo)} missing information`);
  if (r.skippedNotGenerated) parts.push(`${fmt(r.skippedNotGenerated)} not generated`);
  return parts.length ? `Skipped: ${parts.join(', ')}.` : 'Nothing was skipped.';
}

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
