import * as React from 'react';
import type { Employee, Filters } from './mockApi';
import { DEPARTMENTS, EMPLOYMENT_TYPES, LOCATIONS } from './mockApi';
import type { PageCheckState, RowCheckState } from './selection';

export const fmt = (n: number) => n.toLocaleString('en-US');

/** Header checkbox: yes / no / partial. */
export function TriStateCheckbox({
  state,
  onChange,
  label,
  disabled,
}: {
  state: PageCheckState;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={state === 'all'}
      aria-label={label}
      onChange={(e) => onChange(state === 'some' ? true : e.target.checked)}
    />
  );
}

/**
 * Row checkbox with the third state the doc argues about: `unknown`, meaning a
 * select-all is in force whose filter is not the one on screen, so the frontend
 * is guessing. It renders as ticked-but-dashed, because guessing "ticked" is
 * what a real implementation does.
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
      <button
        type="button"
        className="bap-unknown-check"
        disabled={disabled}
        aria-label={`${label} — selection state unknown to the frontend`}
        title="A select-all is active for a different filter. The frontend holds a filter and a count, not a list of ids, so it cannot know whether this row is inside it."
        onClick={() => onChange(false)}
      >
        ?
      </button>
    );
  }
  return (
    <input
      type="checkbox"
      disabled={disabled}
      checked={state === 'checked'}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

// ------------------------------------------------------------------ filters ---

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
    <div className="bap-filter-group">
      <div className="bap-filter-title">{title}</div>
      <div className="bap-chips">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              className="bap-chip"
              data-on={on}
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
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
    <section className="bap-filters" aria-label="Filters">
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
      <div className="bap-filter-group bap-filter-search">
        <div className="bap-filter-title">Search</div>
        <input
          type="search"
          value={filters.search}
          disabled={disabled}
          placeholder="Name or email"
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
    </section>
  );
}

// --------------------------------------------------------------- data table ---

export type RowView = {
  employee: Employee;
  state: RowCheckState;
  /** Ground truth from the mock backend, shown only when "reveal" is on. */
  trulySelected: boolean;
};

export function EmployeeTable({
  rows,
  loading,
  pageState,
  reveal,
  disabled,
  onToggleRow,
  onTogglePage,
}: {
  rows: RowView[];
  loading: boolean;
  pageState: PageCheckState;
  reveal: boolean;
  disabled?: boolean;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
}) {
  return (
    <div className="bap-table-wrap" data-loading={loading}>
      {loading ? <div className="bap-loading-bar" /> : null}
      <table className="bap-table">
        <thead>
          <tr>
            <th className="bap-col-check" scope="col">
              <TriStateCheckbox
                state={pageState}
                disabled={disabled}
                onChange={onTogglePage}
                label="Select all employees on this page"
              />
            </th>
            <th scope="col">Employee</th>
            <th scope="col">Department</th>
            <th scope="col">Location</th>
            <th scope="col">Type</th>
            {reveal ? <th scope="col">Backend truth</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading ? (
            <tr>
              <td className="bap-empty" colSpan={reveal ? 6 : 5}>
                No employees match these filters.
              </td>
            </tr>
          ) : null}
          {rows.map(({ employee, state, trulySelected }) => {
            // The frontend guesses "selected" for an unknown row; reveal shows
            // where that guess is wrong.
            const feBelieves = state === 'checked' || state === 'unknown';
            const wrong = reveal && feBelieves !== trulySelected;
            return (
              <tr key={employee.id} data-selected={feBelieves} data-wrong={wrong}>
                <td>
                  <RowCheckbox
                    state={state}
                    disabled={disabled}
                    label={`Select ${employee.name}`}
                    onChange={(checked) => onToggleRow(employee.id, checked)}
                  />
                </td>
                <td>
                  <div className="bap-name">{employee.name}</div>
                  <div className="bap-muted-sm">
                    {employee.id} · {employee.jobTitle}
                  </div>
                </td>
                <td>{employee.department}</td>
                <td>{employee.location}</td>
                <td>{employee.employmentType}</td>
                {reveal ? (
                  <td>
                    <span className="bap-truth" data-truth={trulySelected}>
                      {trulySelected ? 'assigned' : 'not assigned'}
                    </span>
                    {wrong ? <span className="bap-truth-warn">UI disagrees</span> : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------- pagination ---

function pageWindow(page: number, pageCount: number): Array<number | '…'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push('…');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  disabled,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav className="bap-pagination" aria-label="Pagination">
      <span className="bap-muted" aria-live="polite">
        {total === 0 ? 'No results' : `Showing ${fmt(start)}–${fmt(end)} of ${fmt(total)}`}
      </span>
      <div className="bap-pages">
        <label className="bap-muted">
          Rows{' '}
          <select
            value={pageSize}
            disabled={disabled}
            aria-label="Rows per page"
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="bap-btn bap-page-btn" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
          ‹<span className="bap-sr"> Previous page</span>
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="bap-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="bap-btn bap-page-btn"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              disabled={disabled}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="bap-btn bap-page-btn"
          disabled={disabled || page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          ›<span className="bap-sr"> Next page</span>
        </button>
      </div>
    </nav>
  );
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bap-toast" role="status">
      <span>{message}</span>
      <button type="button" className="bap-link" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
