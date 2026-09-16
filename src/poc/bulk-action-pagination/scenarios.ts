/**
 * The three walkthroughs from the "Problem Simulation" section of the Notion
 * doc, as replayable scripts. Each drives the real UI -- same reducer, same
 * mock endpoint -- and every step appends a row to the log, giving back the
 * doc's own table plus the column it could only reason about: what the backend
 * would actually assign for the payload the frontend built.
 *
 * Two of the three are the sequences that went wrong when select-alls stacked.
 * Under the Proposal they are where the "clear everything and capture the
 * current filter" rule earns its keep.
 */
import { EMPTY_FILTERS, type Filters } from './mockApi';

export type ScenarioStep =
  | { label: string; kind: 'filter'; filters: Filters }
  | { label: string; kind: 'select-all' }
  | { label: string; kind: 'exclude-first-row' };

export type Scenario = {
  id: string;
  title: string;
  /** Which table in the doc this reproduces. */
  docRef: string;
  expectation: string;
  steps: ScenarioStep[];
};

const filters = (f: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...f });

export const SCENARIOS: Scenario[] = [
  {
    id: 'happy',
    title: 'Select all with combinable filters (happy path)',
    docRef: '✅ Select all with combinable filters',
    expectation:
      'Two select-alls over filters that share nobody. Stacking them would have given the right answer here — which is exactly why stacking looked safe. The Proposal keeps only the second, so the count is Finance’s total.',
    steps: [
      { label: 'Filter A — Department: Engineering', kind: 'filter', filters: filters({ departments: ['Engineering'] }) },
      { label: 'Select all in filter A result', kind: 'select-all' },
      { label: 'Filter B — Department: Finance', kind: 'filter', filters: filters({ departments: ['Finance'] }) },
      { label: 'Select all in filter B result', kind: 'select-all' },
    ],
  },
  {
    id: 'overlap',
    title: 'Select all with combinable filters (error)',
    docRef: '💥 Select all with combinable filters',
    expectation:
      'The second filter is the first one narrowed, so stacking would count the overlap twice: the frontend cannot know how much of A is inside A + B. Replacing instead of stacking makes the question unnecessary.',
    steps: [
      { label: 'Filter A — Department: Engineering', kind: 'filter', filters: filters({ departments: ['Engineering'] }) },
      { label: 'Select all in filter A result', kind: 'select-all' },
      {
        label: 'Filter A + B — Engineering, Makati',
        kind: 'filter',
        filters: filters({ departments: ['Engineering'], locations: ['Makati'] }),
      },
      { label: 'Select all in filter A + B result', kind: 'select-all' },
    ],
  },
  {
    id: 'exclusion',
    title: 'Exclusion with combinable filters (error)',
    docRef: '💥 Exclusion with combinable filters',
    expectation:
      'An employee is excluded while filtered to their department, then the filter moves to a location and select-all is clicked again. Stacking would carry the exclusion into a payload it was never meant for; clearing on the second select-all drops it with the scope it belonged to.',
    steps: [
      { label: 'Filter — Department: Engineering', kind: 'filter', filters: filters({ departments: ['Engineering'] }) },
      { label: 'Select all in department result', kind: 'select-all' },
      { label: 'Exclude the first employee on the page', kind: 'exclude-first-row' },
      { label: 'Filter — Location: Makati', kind: 'filter', filters: filters({ locations: ['Makati'] }) },
      { label: 'Select all in location result', kind: 'select-all' },
    ],
  },
];

/** One executed step, in the column layout the doc's tables use. */
export type LogRow = {
  n: number;
  action: string;
  beReturn: string;
  fePayload: string;
  uiCount: number;
  actualCount: number;
};
