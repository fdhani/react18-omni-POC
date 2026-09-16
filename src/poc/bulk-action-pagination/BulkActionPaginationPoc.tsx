import * as React from 'react';
import './poc.css';
import {
  EMPTY_FILTERS,
  type Employee,
  type Filters,
  TOTAL_EMPLOYEES,
  countMatching,
  describeFilters,
  fetchEmployees,
  isTrulySelected,
  resolveSelection,
} from './mockApi';
import {
  EMPTY_SELECTION,
  type SelectionState,
  STRATEGIES,
  type StrategyId,
  buildPayload,
  pageCheckState,
  reduce,
  rowCheckState,
  scopeCoversCurrentFilter,
  shouldOfferSelectAll,
  strategyById,
  uiCount,
} from './selection';
import { SCENARIOS, type LogRow, type Scenario } from './scenarios';
import { EmployeeTable, FilterBar, Pagination, Toast, fmt, type RowView } from './components';

/**
 * Prototype for "Problem: Assign Employee with paginated select-all in Add
 * Entitlement" (Notion, Ad Hoc Time Off FE).
 *
 * It is the Add Entitlement step-2 employee picker: 10,000 employees behind a
 * paginated, combinably-filtered endpoint. Every option the doc weighs is
 * implemented behind one switch, over one dataset, so the same clicks can be
 * replayed under each and compared.
 *
 * The column the doc could only argue about is rendered here as fact: beside
 * the count the frontend shows sits the count the backend would actually
 * assign, because the mock backend can resolve the payload the frontend built.
 * Where those two numbers part company, the option is broken.
 */

const DEFAULT_PAGE_SIZE = 25;

export default function BulkActionPaginationPoc() {
  const [strategyId, setStrategyId] = React.useState<StrategyId>('proposal');
  const strategy = strategyById(strategyId);

  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [selection, setSelection] = React.useState<SelectionState>(EMPTY_SELECTION);

  const [rows, setRows] = React.useState<Employee[]>([]);
  const [totalCount, setTotalCount] = React.useState(TOTAL_EMPLOYEES);
  const [loading, setLoading] = React.useState(true);

  const [reveal, setReveal] = React.useState(false);
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);

  // --------------------------------------------------------------- fetching ---

  // Only ever one page of rows plus a total. Everything downstream has to work
  // from that, which is the whole problem.
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

  const payload = React.useMemo(() => buildPayload(selection, EMPTY_FILTERS), [selection]);
  const believedCount = uiCount(selection);
  const actualCount = React.useMemo(() => resolveSelection(payload).size, [payload]);
  const diverges = believedCount !== actualCount;

  const rowViews: RowView[] = React.useMemo(
    () =>
      rows.map((employee) => ({
        employee,
        state: rowCheckState(selection, employee.id, filters),
        trulySelected: isTrulySelected(payload, employee.id),
      })),
    [rows, selection, filters, payload],
  );

  const pageState = pageCheckState(rowViews.map((r) => r.state));
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeScope = selection.scopes[selection.scopes.length - 1];
  const scopeIsCurrentFilter = scopeCoversCurrentFilter(selection, filters);
  const offerSelectAll = shouldOfferSelectAll(selection, strategy, pageState, totalCount, pageSize, filters);
  const busy = running !== null;

  // ----------------------------------------------------------------- logging ---

  /** Appends one row in the column layout the doc's simulation tables use. */
  const appendLog = React.useCallback(
    (action: string, atFilters: Filters, next: SelectionState) => {
      const nextPayload = buildPayload(next, EMPTY_FILTERS);
      setLog((prev) => [
        ...prev,
        {
          n: prev.length + 1,
          action,
          beReturn: `page: 1 · totalCount: ${fmt(countMatching(atFilters))}`,
          fePayload: formatPayload(nextPayload),
          uiCount: uiCount(next),
          actualCount: resolveSelection(nextPayload).size,
        },
      ]);
    },
    [],
  );

  // ----------------------------------------------------------------- actions ---

  const apply = React.useCallback(
    (next: SelectionState, action: string, atFilters: Filters) => {
      setSelection(next);
      appendLog(action, atFilters, next);
    },
    [appendLog],
  );

  const changeFilters = (next: Filters) => {
    const hadSelection = uiCount(selection) > 0;
    const nextSelection = reduce(selection, { type: 'filters-changed' }, strategy);
    setFilters(next);
    setPage(1);
    setSelection(nextSelection);
    if (strategy.resetsOnFilterChange && hadSelection) {
      setToast('Selection cleared due to filter change');
    }
    appendLog(`Filter — ${describeFilters(next)}`, next, nextSelection);
  };

  const toggleRow = (id: string, checked: boolean) => {
    const next = reduce(selection, { type: 'toggle-row', id, selected: checked, underFilters: filters }, strategy);
    apply(next, `${checked ? 'Include' : 'Exclude'} ${id}`, filters);
  };

  const togglePage = (checked: boolean) => {
    const ids = rows.map((r) => r.id);
    const next = reduce(selection, { type: 'toggle-page', ids, selected: checked, underFilters: filters }, strategy);
    apply(next, `${checked ? 'Select' : 'Deselect'} the ${ids.length} rows on this page`, filters);
  };

  const selectAllMatching = () => {
    const next = reduce(selection, { type: 'select-all-matching', filters }, strategy);
    apply(next, `Select all in "${describeFilters(filters)}" result`, filters);
  };

  const selectAllInSystem = () => {
    const next = reduce(selection, { type: 'select-all-in-system' }, strategy);
    apply(next, 'Select all employees in the system', filters);
  };

  const clearSelection = () => {
    const next = reduce(selection, { type: 'clear' }, strategy);
    apply(next, 'Clear selection', filters);
  };

  const changeStrategy = (id: StrategyId) => {
    setStrategyId(id);
    setSelection(EMPTY_SELECTION);
    setLog([]);
    setToast(null);
  };

  const resetAll = () => {
    setSelection(EMPTY_SELECTION);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setLog([]);
    setToast(null);
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
    setToast(null);
    setFilters(EMPTY_FILTERS);
    setPage(1);

    let sel = EMPTY_SELECTION;
    let current = EMPTY_FILTERS;
    await wait(400);

    for (const step of scenario.steps) {
      switch (step.kind) {
        case 'filter': {
          current = step.filters;
          setFilters(current);
          setPage(1);
          sel = reduce(sel, { type: 'filters-changed' }, strategy);
          break;
        }
        case 'select-all': {
          sel = reduce(sel, { type: 'select-all-matching', filters: current }, strategy);
          break;
        }
        case 'exclude-first-row': {
          const first = (await fetchEmployees(current, 1, pageSize)).employees[0];
          if (first) {
            sel = reduce(sel, { type: 'toggle-row', id: first.id, selected: false, underFilters: current }, strategy);
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
    <main className="bap">
      <header className="bap-head">
        <p className="bap-eyebrow">Prototype · Ad Hoc Time Off FE</p>
        <h1>Add New Entitlement — Step 2: Assign employees</h1>
        <p className="bap-sub">
          {fmt(TOTAL_EMPLOYEES)} employees behind a paginated, combinably-filtered endpoint. The
          browser is handed one page of {pageSize} rows and a <code>totalCount</code> — never the
          other {fmt(TOTAL_EMPLOYEES - pageSize)} — so &ldquo;select all&rdquo; has to be expressed
          as intent rather than as a list of ids. Every option from{' '}
          <em>Problem: Assign Employee with paginated select-all in Add Entitlement</em> is wired up
          below, over the same dataset.
        </p>
      </header>

      <section className="bap-panel" aria-label="Selection strategy">
        <div className="bap-panel-title">Selection strategy</div>
        <div className="bap-strategies">
          {STRATEGIES.map((s) => (
            <label key={s.id} className="bap-strategy" data-on={s.id === strategyId}>
              <input
                type="radio"
                name="strategy"
                value={s.id}
                checked={s.id === strategyId}
                disabled={busy}
                onChange={() => changeStrategy(s.id)}
              />
              <span>
                <span className="bap-strategy-label">{s.label}</span>
                <span className="bap-badge" data-verdict={s.verdict}>
                  {s.verdict === 'accurate' ? 'count holds' : 'count drifts'}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="bap-strategy-summary">{strategy.summary}</p>
        <p className="bap-strategy-note">{strategy.note}</p>
      </section>

      <FilterBar filters={filters} onChange={changeFilters} disabled={busy} />

      <section className="bap-countbar" aria-live="polite">
        <div>
          <span className="bap-count">{fmt(believedCount)}</span>
          <span className="bap-count-total"> / {fmt(TOTAL_EMPLOYEES)} selected</span>
          <span className="bap-muted-sm"> — what the frontend believes</span>
        </div>
        <div className="bap-truthbox" data-diverges={diverges}>
          <span className="bap-truthbox-label">Backend would assign</span>
          <strong>{fmt(actualCount)}</strong>
          <span className="bap-truthbox-verdict">
            {diverges ? `✗ off by ${fmt(Math.abs(believedCount - actualCount))}` : '✓ matches'}
          </span>
        </div>
        <label className="bap-reveal">
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
          Reveal backend truth per row
        </label>
        <button type="button" className="bap-btn" onClick={clearSelection} disabled={busy || believedCount === 0}>
          Clear selection
        </button>
      </section>

      {strategy.id === 'global' ? (
        <label className="bap-banner bap-banner-check">
          <input
            type="checkbox"
            checked={selection.allInSystem}
            disabled={busy}
            onChange={(e) => (e.target.checked ? selectAllInSystem() : clearSelection())}
          />
          Select all {fmt(TOTAL_EMPLOYEES)} employees — filters only change what is displayed
        </label>
      ) : null}

      {offerSelectAll ? (
        <div className="bap-banner">
          All {rows.length} employees on this page are selected.{' '}
          <button type="button" className="bap-link" onClick={selectAllMatching} disabled={busy}>
            Select all {fmt(totalCount)} employees matching your filters
          </button>
        </div>
      ) : null}

      {selection.scopes.length > 1 ? (
        // Option D only. The banner has to describe the stack, not the last
        // capture, because the count on screen is the sum of every capture.
        <div className="bap-banner" data-tone="warn">
          <b>{selection.scopes.length} select-alls are stacked:</b>{' '}
          {selection.scopes.map((s) => s.label).join(' · ')}. The frontend adds their totals (
          {selection.scopes.map((s) => fmt(s.total)).join(' + ')} ={' '}
          {fmt(selection.scopes.reduce((n, sc) => n + sc.total, 0))}) and has no way to subtract anyone who matches more than one of them.{' '}
          <button type="button" className="bap-link" onClick={clearSelection} disabled={busy}>
            Clear selection
          </button>
        </div>
      ) : activeScope && !selection.allInSystem ? (
        <div className="bap-banner" data-tone={scopeIsCurrentFilter ? 'ok' : 'warn'}>
          {scopeIsCurrentFilter ? (
            <>
              All {fmt(activeScope.total)} employees matching <b>{activeScope.label}</b> are selected
              {selection.exclude.length
                ? `, minus ${selection.exclude.length} excluded individually`
                : ''}
              .{' '}
              <button type="button" className="bap-link" onClick={clearSelection} disabled={busy}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              Select-all is held against <b>{activeScope.label}</b>, which is not the filter on
              screen. The frontend cannot tell which of these rows that covers, so their checkboxes
              read <span className="bap-inline-unknown">?</span>.{' '}
              <button type="button" className="bap-link" onClick={selectAllMatching} disabled={busy}>
                {strategy.onSecondSelectAll === 'stack'
                  ? `Also select all ${fmt(totalCount)} matching this filter`
                  : `Select all ${fmt(totalCount)} matching this filter instead`}
              </button>
            </>
          )}
        </div>
      ) : null}

      <EmployeeTable
        rows={rowViews}
        loading={loading}
        pageState={pageState}
        reveal={reveal}
        disabled={busy}
        onToggleRow={toggleRow}
        onTogglePage={togglePage}
      />

      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={totalCount}
        disabled={busy}
        onPage={setPage}
        onPageSize={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      <section className="bap-panel" aria-label="Payload sent to the backend">
        <div className="bap-panel-title">Payload the frontend would submit</div>
        <pre className="bap-code">{JSON.stringify(payload, null, 2)}</pre>
        <p className="bap-muted-sm">
          The backend resolves this to {fmt(actualCount)} employee{actualCount === 1 ? '' : 's'}: the
          union of every filter above, plus <code>include</code>, minus <code>exclude</code>. The
          frontend never sees that number before submitting — it shows {fmt(believedCount)}.
        </p>
      </section>

      <section className="bap-panel" aria-label="Scenarios from the doc">
        <div className="bap-panel-title">Replay the doc’s simulations</div>
        <p className="bap-muted-sm">
          Each one drives the controls above under the strategy you picked. Run the same scenario
          under &ldquo;Option D&rdquo; and then under &ldquo;Proposal&rdquo; to see where the counts
          part company.
          {!strategy.offersSelectAll ? (
            <>
              {' '}
              <b>
                This strategy has no cross-page select-all, so the select-all steps do nothing and
                the run ends at 0 — which is the honest answer for it.
              </b>
            </>
          ) : null}
          {strategy.id === 'global' ? (
            <>
              {' '}
              <b>
                This strategy ignores filters, so every select-all step selects all{' '}
                {fmt(TOTAL_EMPLOYEES)} regardless of the scenario’s filters.
              </b>
            </>
          ) : null}
        </p>
        <div className="bap-scenarios">
          {SCENARIOS.map((s) => (
            <div key={s.id} className="bap-scenario">
              <div className="bap-scenario-head">
                <span className="bap-scenario-ref">{s.docRef}</span>
                <button
                  type="button"
                  className="bap-btn bap-btn-primary"
                  disabled={busy}
                  onClick={() => runScenario(s)}
                >
                  {running === s.id ? 'Running…' : 'Run'}
                </button>
              </div>
              <div className="bap-scenario-title">{s.title}</div>
              <p className="bap-muted-sm">{s.expectation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bap-panel" aria-label="Action log">
        <div className="bap-panel-title">
          Action log
          {log.length ? (
            <button type="button" className="bap-link" onClick={() => setLog([])}>
              clear
            </button>
          ) : null}
        </div>
        {log.length === 0 ? (
          <p className="bap-muted-sm">
            Every action — filter, select-all, tick, untick — appends a row here, in the same
            columns the doc’s simulation tables use.
          </p>
        ) : (
          <div className="bap-log-wrap">
            <table className="bap-table bap-log">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Action</th>
                  <th scope="col">BE return</th>
                  <th scope="col">FE payload</th>
                  <th scope="col">Count in UI</th>
                  <th scope="col">Actually assigned</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => {
                  const wrong = r.uiCount !== r.actualCount;
                  return (
                    <tr key={r.n} data-wrong={wrong}>
                      <td className="bap-muted">{r.n}</td>
                      <td>{r.action}</td>
                      <td className="bap-mono-sm">{r.beReturn}</td>
                      <td className="bap-mono-sm">{r.fePayload}</td>
                      <td className="bap-mono-sm">
                        {fmt(r.uiCount)} / {fmt(TOTAL_EMPLOYEES)}
                      </td>
                      <td className="bap-mono-sm">
                        {fmt(r.actualCount)} {wrong ? <span className="bap-truth-warn">✗</span> : '✓'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="bap-foot">
        <button type="button" className="bap-btn" onClick={resetAll} disabled={busy}>
          Reset prototype
        </button>
        <span className="bap-muted-sm">
          Mock backend, deterministic dataset, no network. Source: <code>src/poc/bulk-action-pagination/</code>
        </span>
      </footer>

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Compact one-line rendering of the payload, for the log's narrow column. */
function formatPayload(p: ReturnType<typeof buildPayload>): string {
  if (!p.selectAll && p.include.length === 0) return '—';
  const parts: string[] = [];
  if (p.selectAll) {
    parts.push('selectAll: true');
    parts.push(`filter: [${p.filters.map((f) => describeFilters(f)).join('] [')}]`);
  }
  if (p.include.length) parts.push(`include: [${p.include.length}]`);
  if (p.exclude.length) parts.push(`exclude: [${p.exclude.join(', ')}]`);
  return parts.join('\n');
}
