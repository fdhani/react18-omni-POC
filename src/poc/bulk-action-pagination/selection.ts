/**
 * Selection state for the paginated employee picker.
 *
 * Implements the Proposal from "Problem: Assign Employee with paginated
 * select-all in Add Entitlement":
 *
 *   - there is only one kind of select-all, and it captures the filter that is
 *     on screen when it is clicked;
 *   - select-alls never stack: a second one clears everything and captures the
 *     new filter instead. Someone who wants A and B builds the filter A + B and
 *     selects all once;
 *   - on top of that the user can still include and exclude individuals.
 *
 * What the frontend holds is therefore a filter and a number, never a list of
 * ids — which is the whole point, and also the one thing it cannot do: while
 * the filter on screen is not the captured one, it cannot tell whether a given
 * row is inside the select-all. `rowCheckState` returns `unknown` there rather
 * than guessing.
 */
import {
  type EmployeeId,
  type Filters,
  type SelectionPayload,
  type TaxYear,
  countMatching,
  describeFilters,
  filtersEqual,
} from './mockApi';

/** The select-all in force: the filter it captured, and the total the backend reported for it. */
export type SelectAllScope = {
  filters: Filters;
  total: number;
  label: string;
};

export type SelectionState = {
  scope: SelectAllScope | null;
  include: EmployeeId[];
  exclude: EmployeeId[];
};

export const EMPTY_SELECTION: SelectionState = { scope: null, include: [], exclude: [] };

export type SelectionEvent =
  | { type: 'toggle-row'; id: EmployeeId; selected: boolean; underFilters: Filters }
  | { type: 'toggle-page'; ids: EmployeeId[]; selected: boolean; underFilters: Filters }
  | { type: 'select-all-matching'; filters: Filters; year: TaxYear }
  | { type: 'clear' };

const without = (list: EmployeeId[], id: EmployeeId) => list.filter((x) => x !== id);
const with_ = (list: EmployeeId[], id: EmployeeId) => (list.includes(id) ? list : [...list, id]);

export function reduce(state: SelectionState, event: SelectionEvent): SelectionState {
  switch (event.type) {
    case 'toggle-row': {
      if (!state.scope) {
        // No select-all yet: ticking rows just builds a list of ids.
        return event.selected
          ? { ...state, include: with_(state.include, event.id) }
          : { ...state, include: without(state.include, event.id) };
      }
      if (!event.selected) {
        return { ...state, include: without(state.include, event.id), exclude: with_(state.exclude, event.id) };
      }
      // Recording an explicit include for a row the select-all already covers
      // would count it twice. That is only safe to skip when the frontend can
      // prove the coverage, which it can only do while the filter on screen is
      // the captured one.
      const provablyCovered = filtersEqual(state.scope.filters, event.underFilters);
      return {
        ...state,
        exclude: without(state.exclude, event.id),
        include: provablyCovered ? without(state.include, event.id) : with_(state.include, event.id),
      };
    }

    case 'toggle-page': {
      let next = state;
      for (const id of event.ids) {
        next = reduce(next, { type: 'toggle-row', id, selected: event.selected, underFilters: event.underFilters });
      }
      return next;
    }

    case 'select-all-matching':
      // "Any following select-all action will clear everything, and select all
      // in the current filter."
      return {
        scope: {
          filters: event.filters,
          total: countMatching(event.filters, event.year),
          label: describeFilters(event.filters),
        },
        include: [],
        exclude: [],
      };

    case 'clear':
      return EMPTY_SELECTION;

    default:
      return state;
  }
}

// ---------------------------------------------------------------- derived ---

/**
 * The count the frontend can justify: one captured totalCount, plus the rows
 * ticked individually, minus the rows unticked. Never a sum of totals, so it
 * cannot double-count anyone.
 */
export function selectedCount(state: SelectionState): number {
  if (!state.scope) return state.include.length;
  const extra = state.include.filter((id) => !state.exclude.includes(id)).length;
  return state.scope.total + extra - state.exclude.length;
}

export function buildPayload(state: SelectionState): SelectionPayload {
  return {
    selectAll: state.scope !== null,
    filter: state.scope ? state.scope.filters : null,
    include: [...state.include],
    exclude: [...state.exclude],
  };
}

export type RowCheckState = 'checked' | 'unchecked' | 'unknown';

export function rowCheckState(
  state: SelectionState,
  id: EmployeeId,
  currentFilters: Filters,
): RowCheckState {
  if (state.exclude.includes(id)) return 'unchecked';
  if (state.include.includes(id)) return 'checked';
  if (!state.scope) return 'unchecked';
  // A row on screen matches the current filter by definition, so a scope
  // captured under that same filter definitely covers it.
  if (filtersEqual(state.scope.filters, currentFilters)) return 'checked';
  return 'unknown';
}

export type PageCheckState = 'none' | 'some' | 'all';

export function pageCheckState(states: RowCheckState[]): PageCheckState {
  if (states.length === 0) return 'none';
  const selected = states.filter((s) => s !== 'unchecked').length;
  if (selected === 0) return 'none';
  return selected === states.length ? 'all' : 'some';
}

export function scopeCoversCurrentFilter(state: SelectionState, currentFilters: Filters): boolean {
  return state.scope !== null && filtersEqual(state.scope.filters, currentFilters);
}

/** Gmail's banner: the page is fully ticked, there is more behind it, and no select-all is in force yet. */
export function shouldOfferSelectAll(
  state: SelectionState,
  pageState: PageCheckState,
  totalCount: number,
  pageSize: number,
): boolean {
  if (state.scope) return false;
  if (totalCount <= pageSize) return false;
  return pageState === 'all';
}
