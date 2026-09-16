/**
 * The three walkthroughs from the "Problem Simulation" section of the Notion
 * doc, as replayable scripts. Each one drives the real UI -- same reducer, same
 * mock endpoint -- and every step appends a row to the log, so the result is
 * the doc's table with two columns the doc could only reason about: the count
 * the frontend shows, and the count the backend would actually assign.
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
      'Two select-alls over filters that share nobody. Adding the two totals happens to be right, which is exactly why the bug in the next scenario survives review.',
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
      'The second filter is the first one narrowed, so its people are already selected. The frontend adds the two totalCounts anyway — it cannot know how much of A is inside A + B.',
    steps: [
      { label: 'Filter A — Department: Engineering', kind: 'filter', filters: filters({ departments: ['Engineering'] }) },
      { label: 'Select all in filter A result', kind: 'select-all' },
      {
        label: 'Filter A + B — Engineering, Singapore',
        kind: 'filter',
        filters: filters({ departments: ['Engineering'], locations: ['Singapore'] }),
      },
      { label: 'Select all in filter A + B result', kind: 'select-all' },
    ],
  },
  {
    id: 'exclusion',
    title: 'Exclusion with combinable filters (error)',
    docRef: '💥 Exclusion with combinable filters',
    expectation:
      'An employee is excluded while filtered to their department, then the filter moves to a location. The exclusion rides along into a payload it was never meant for, and the frontend cannot tell whether it still applies.',
    steps: [
      { label: 'Filter — Department: Engineering', kind: 'filter', filters: filters({ departments: ['Engineering'] }) },
      { label: 'Select all in department result', kind: 'select-all' },
      { label: 'Exclude the first employee on the page', kind: 'exclude-first-row' },
      { label: 'Filter — Location: Singapore', kind: 'filter', filters: filters({ locations: ['Singapore'] }) },
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
