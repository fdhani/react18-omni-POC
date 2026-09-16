/**
 * The selection state machine, with one variant per option in the Notion doc.
 *
 * All variants share the same state shape and the same events; they differ only
 * in how they answer three questions:
 *
 *   1. what does "select all" capture?
 *   2. what happens to the selection when the filters change?
 *   3. what count can the frontend show, knowing only `totalCount` per filter?
 *
 * Keeping them in one reducer is the point of the prototype: the same clicks
 * can be replayed under each option and the resulting counts compared against
 * what the backend would actually do.
 */
import {
  type EmployeeId,
  type Filters,
  type SelectionPayload,
  TOTAL_EMPLOYEES,
  countMatching,
  describeFilters,
  filtersEqual,
} from './mockApi';

export type StrategyId = 'page-only' | 'gmail-reset' | 'global' | 'stacking' | 'proposal';

export type Strategy = {
  id: StrategyId;
  label: string;
  docRef: string;
  /** Is the Gmail-style "select all N matching" banner offered at all? */
  offersSelectAll: boolean;
  /** Does changing a filter wipe the selection? */
  resetsOnFilterChange: boolean;
  /** Does a second select-all stack on top of the first, or replace it? */
  onSecondSelectAll: 'stack' | 'replace' | 'n/a';
  summary: string;
  verdict: 'accurate' | 'inaccurate';
  /** Why the count can or cannot drift from what the backend will do. */
  note: string;
};

export const STRATEGIES: Strategy[] = [
  {
    id: 'proposal',
    label: 'Proposal — one select-all, replaced each time',
    docRef: 'Proposal',
    offersSelectAll: true,
    resetsOnFilterChange: false,
    onSecondSelectAll: 'replace',
    summary:
      'Select-all captures the current filter. A second select-all clears everything and captures the new filter instead — select-alls never stack. Includes and excludes survive a filter change.',
    verdict: 'accurate',
    note:
      'The count is always one filter’s totalCount ± explicit rows, so it cannot drift. The cost is visible in the table: while you are on a different filter than the captured one, the frontend cannot tell whether a row is inside the select-all, and renders “unknown”.',
  },
  {
    id: 'gmail-reset',
    label: 'Option A / Variant 2 — Gmail banner, reset on filter change',
    docRef: 'Option A, Variant 2',
    offersSelectAll: true,
    resetsOnFilterChange: true,
    onSecondSelectAll: 'replace',
    summary:
      'Header checkbox selects the page; a banner offers "select all N matching". Any filter change clears the selection and shows a toast.',
    verdict: 'accurate',
    note:
      'Because the selection is destroyed the moment the filter moves, the captured filter is always the filter on screen — so no row is ever “unknown” and the count is always exact. The cost is paid by the user, who loses the selection.',
  },
  {
    id: 'global',
    label: 'Variant 1 — select all in system, filters ignored',
    docRef: 'Variant 1',
    offersSelectAll: true,
    resetsOnFilterChange: false,
    onSecondSelectAll: 'replace',
    summary:
      'One checkbox selects all 10,000 employees regardless of filters. Filters only change what is displayed.',
    verdict: 'accurate',
    note:
      'Nothing to get wrong: membership is "everyone", so every row renders correctly and the count is 10,000 minus the excludes. Useless for a targeted assignment, which is what Add Entitlement actually needs.',
  },
  {
    id: 'page-only',
    label: 'Option B — current page only',
    docRef: 'Option B',
    offersSelectAll: false,
    resetsOnFilterChange: false,
    onSecondSelectAll: 'n/a',
    summary:
      'The header checkbox ticks the rows on this page and nothing else. There is no cross-page select-all.',
    verdict: 'accurate',
    note:
      'Every selected id is known by the frontend, so the count is just the size of the set. Assigning 1,600 people means visiting 64 pages.',
  },
  {
    id: 'stacking',
    label: 'Option D — filter-aware stacking (what we tried)',
    docRef: 'Option D',
    offersSelectAll: true,
    resetsOnFilterChange: false,
    onSecondSelectAll: 'stack',
    summary:
      'Every select-all appends its filter to the payload. The count adds up each captured totalCount.',
    verdict: 'inaccurate',
    note:
      'The frontend adds totals it cannot de-duplicate: if the second filter overlaps the first, the same people are counted twice. Excludes captured under one filter also keep applying under the next. Both divergences are reproduced by the scenarios below.',
  },
];

export function strategyById(id: StrategyId): Strategy {
  const found = STRATEGIES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown strategy: ${id}`);
  return found;
}

/**
 * A select-all the user performed: the filter that was on screen, and the
 * `totalCount` the backend reported for it. The count is a *snapshot* — the
 * frontend has no way to recompute it later.
 */
export type SelectAllScope = {
  filters: Filters;
  total: number;
  label: string;
};

export type SelectionState = {
  /** Select-alls captured so far. 'page-only' never has any; 'stacking' can have several. */
  scopes: SelectAllScope[];
  /** Variant 1's "everyone in the system", which no filter narrows. */
  allInSystem: boolean;
  include: EmployeeId[];
  exclude: EmployeeId[];
};

export const EMPTY_SELECTION: SelectionState = {
  scopes: [],
  allInSystem: false,
  include: [],
  exclude: [],
};

export type SelectionEvent =
  | { type: 'toggle-row'; id: EmployeeId; selected: boolean; underFilters: Filters }
  | { type: 'toggle-page'; ids: EmployeeId[]; selected: boolean; underFilters: Filters }
  | { type: 'select-all-matching'; filters: Filters }
  | { type: 'select-all-in-system' }
  | { type: 'filters-changed' }
  | { type: 'clear' };

const without = (list: EmployeeId[], id: EmployeeId) => list.filter((x) => x !== id);
const with_ = (list: EmployeeId[], id: EmployeeId) => (list.includes(id) ? list : [...list, id]);

/** True when a select-all is in force that could already cover `id`. */
function coveredBySelectAll(state: SelectionState): boolean {
  return state.allInSystem || state.scopes.length > 0;
}

export function reduce(
  state: SelectionState,
  event: SelectionEvent,
  strategy: Strategy,
): SelectionState {
  switch (event.type) {
    case 'toggle-row': {
      // Under a select-all, ticking a row means "stop excluding it" and
      // unticking means "exclude it". Without one, the same gesture edits the
      // include list. Same click, opposite bookkeeping.
      if (coveredBySelectAll(state)) {
        if (!event.selected) {
          return { ...state, include: without(state.include, event.id), exclude: with_(state.exclude, event.id) };
        }
        // Recording an explicit include for a row the select-all already covers
        // would count it twice. That is only safe to skip when the frontend can
        // prove the coverage -- which it can only do while the filter on screen
        // is the one the select-all captured.
        const provablyCovered =
          state.allInSystem || state.scopes.some((s) => filtersEqual(s.filters, event.underFilters));
        return {
          ...state,
          exclude: without(state.exclude, event.id),
          include: provablyCovered ? without(state.include, event.id) : with_(state.include, event.id),
        };
      }
      return event.selected
        ? { ...state, include: with_(state.include, event.id) }
        : { ...state, include: without(state.include, event.id) };
    }

    case 'toggle-page': {
      let next = state;
      for (const id of event.ids) {
        next = reduce(next, { type: 'toggle-row', id, selected: event.selected, underFilters: event.underFilters }, strategy);
      }
      return next;
    }

    case 'select-all-matching': {
      // Option B has no select-all to perform, and Variant 1's only select-all
      // is the filter-independent one. Replaying a scenario under either has to
      // do what that option can actually do, not borrow another's affordance.
      if (!strategy.offersSelectAll) return state;
      if (strategy.id === 'global') return reduce(state, { type: 'select-all-in-system' }, strategy);
      const scope: SelectAllScope = {
        filters: event.filters,
        total: countMatching(event.filters),
        label: describeFilters(event.filters),
      };
      if (strategy.onSecondSelectAll === 'stack') {
        // Option D: append, and keep the existing excludes -- exactly the
        // behaviour the doc's two error tables describe.
        const alreadyCaptured = state.scopes.some((s) => filtersEqual(s.filters, scope.filters));
        return alreadyCaptured ? state : { ...state, scopes: [...state.scopes, scope] };
      }
      // Proposal / Gmail: "any following select-all action will clear
      // everything, and select all in the current filter".
      return { scopes: [scope], allInSystem: false, include: [], exclude: [] };
    }

    case 'select-all-in-system':
      return { scopes: [], allInSystem: true, include: [], exclude: [] };

    case 'filters-changed':
      return strategy.resetsOnFilterChange ? EMPTY_SELECTION : state;

    case 'clear':
      return EMPTY_SELECTION;

    default:
      return state;
  }
}

// -------------------------------------------------------- derived, FE-side ---

/**
 * The count the frontend can justify from what it holds: snapshot totals plus
 * explicit rows. Where this is wrong, it is wrong for a reason the doc names.
 */
export function uiCount(state: SelectionState): number {
  if (state.allInSystem) {
    return TOTAL_EMPLOYEES - state.exclude.length;
  }
  if (state.scopes.length === 0) {
    return state.include.length;
  }
  // Summing snapshot totals is the un-deduplicable step: the frontend has no
  // way to know how many people appear in more than one captured filter.
  const base = state.scopes.reduce((n, s) => n + s.total, 0);
  const extraIncludes = state.include.filter((id) => !state.exclude.includes(id)).length;
  return base + extraIncludes - state.exclude.length;
}

export function buildPayload(state: SelectionState, allFilters: Filters): SelectionPayload {
  if (state.allInSystem) {
    return { selectAll: true, filters: [allFilters], include: [...state.include], exclude: [...state.exclude] };
  }
  return {
    selectAll: state.scopes.length > 0,
    filters: state.scopes.map((s) => s.filters),
    include: [...state.include],
    exclude: [...state.exclude],
  };
}

/**
 * What the frontend can render for a row's checkbox.
 *
 * `unknown` is the honest answer whenever a select-all is in force whose filter
 * is not the filter currently on screen: the frontend holds a filter and a
 * number, never the membership list, so it cannot say whether this row is in
 * it. Real implementations paper over this by rendering it checked and hoping.
 */
export type RowCheckState = 'checked' | 'unchecked' | 'unknown';

export function rowCheckState(
  state: SelectionState,
  id: EmployeeId,
  currentFilters: Filters,
): RowCheckState {
  if (state.exclude.includes(id)) return 'unchecked';
  if (state.include.includes(id)) return 'checked';
  if (state.allInSystem) return 'checked';
  if (state.scopes.length === 0) return 'unchecked';
  // A row on screen matches the current filter by definition, so any captured
  // scope equal to it definitely covers this row.
  if (state.scopes.some((s) => filtersEqual(s.filters, currentFilters))) return 'checked';
  return 'unknown';
}

export type PageCheckState = 'none' | 'some' | 'all';

export function pageCheckState(states: RowCheckState[]): PageCheckState {
  if (states.length === 0) return 'none';
  const selected = states.filter((s) => s === 'checked' || s === 'unknown').length;
  if (selected === 0) return 'none';
  return selected === states.length ? 'all' : 'some';
}

/** True when a scope already in force provably covers every row on screen. */
export function scopeCoversCurrentFilter(state: SelectionState, currentFilters: Filters): boolean {
  return state.allInSystem || state.scopes.some((s) => filtersEqual(s.filters, currentFilters));
}

/**
 * When Gmail shows its banner: the whole visible page is ticked, there is more
 * behind it than one page, and no select-all already covers this filter.
 */
export function shouldOfferSelectAll(
  state: SelectionState,
  strategy: Strategy,
  pageState: PageCheckState,
  totalCount: number,
  pageSize: number,
  currentFilters: Filters,
): boolean {
  if (!strategy.offersSelectAll) return false;
  // Once any select-all is in force, the offer to take another one belongs to
  // the scope banner, which can explain whether it replaces or stacks.
  if (state.allInSystem || state.scopes.length > 0) return false;
  if (scopeCoversCurrentFilter(state, currentFilters)) return false;
  if (totalCount <= pageSize) return false;
  return pageState === 'all';
}
