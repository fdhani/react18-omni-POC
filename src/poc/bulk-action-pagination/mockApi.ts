/**
 * Mock backend for the paginated select-all prototype.
 *
 * Simulates the "Add New Entitlement -> Step 2: assign employees" endpoint
 * described in the Notion doc: 10,000 employees behind a paginated, filterable
 * API. The dataset lives *here*, not in the UI. The page component is only ever
 * handed one page of rows plus a `totalCount`, which is the whole reason the
 * select-all problem exists.
 *
 * `resolveSelection` is the deliberate exception: it answers "what would the
 * backend actually do with this payload?". The UI uses it only to display
 * ground truth next to the count the frontend *believes*, so the divergences
 * documented in the Notion tables can be seen rather than argued about.
 */

export type EmployeeId = string;

export type Employee = {
  id: EmployeeId;
  name: string;
  email: string;
  department: string;
  location: string;
  employmentType: string;
  jobTitle: string;
};

export const DEPARTMENTS = [
  'Engineering',
  'People Ops',
  'Finance',
  'Sales',
  'Customer Success',
  'Legal',
] as const;

export const LOCATIONS = [
  'Jakarta',
  'Singapore',
  'Manila',
  'Ho Chi Minh City',
  'Kuala Lumpur',
  'Bangkok',
] as const;

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'] as const;

/** The three filter dimensions are combinable -- the complication the doc calls out. */
export type Filters = {
  departments: string[];
  locations: string[];
  employmentTypes: string[];
  search: string;
};

export const EMPTY_FILTERS: Filters = {
  departments: [],
  locations: [],
  employmentTypes: [],
  search: '',
};

export function filtersAreEmpty(f: Filters): boolean {
  return (
    f.departments.length === 0 &&
    f.locations.length === 0 &&
    f.employmentTypes.length === 0 &&
    f.search.trim() === ''
  );
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  const sameList = (x: string[], y: string[]) =>
    x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
  return (
    sameList(a.departments, b.departments) &&
    sameList(a.locations, b.locations) &&
    sameList(a.employmentTypes, b.employmentTypes) &&
    a.search.trim().toLowerCase() === b.search.trim().toLowerCase()
  );
}

/** Short human label for a filter set, e.g. "Engineering + Singapore". */
export function describeFilters(f: Filters): string {
  if (filtersAreEmpty(f)) return 'No filter (all employees)';
  const parts = [...f.departments, ...f.locations, ...f.employmentTypes];
  if (f.search.trim()) parts.push(`"${f.search.trim()}"`);
  return parts.join(' + ');
}

// ------------------------------------------------------------------ dataset ---

const FIRST = [
  'Aisyah', 'Budi', 'Chandra', 'Dewi', 'Eka', 'Farah', 'Gilang', 'Hana', 'Indra', 'Joko',
  'Kiran', 'Lina', 'Maya', 'Naufal', 'Oscar', 'Putri', 'Rama', 'Sari', 'Tio', 'Umi',
  'Vera', 'Wawan', 'Yuni', 'Zaki', 'Amara', 'Bayu', 'Citra', 'Dimas', 'Elena', 'Fajar',
  'Gita', 'Hendra', 'Intan', 'Jamal', 'Kartika', 'Leo', 'Mira', 'Nadia', 'Omar', 'Prita',
];
const LAST = [
  'Pratama', 'Wijaya', 'Santoso', 'Halim', 'Kusuma', 'Nugroho', 'Sinaga', 'Lestari',
  'Mahendra', 'Rahmawati', 'Siregar', 'Gunawan', 'Permana', 'Anggraini', 'Hutapea',
  'Salim', 'Tanoto', 'Wibowo', 'Yulianto', 'Zulkifli',
];
const TITLES = [
  'Associate', 'Specialist', 'Senior Specialist', 'Manager', 'Lead', 'Analyst', 'Coordinator',
];

/** Deterministic PRNG: the dataset must be identical on every reload for scenarios to be comparable. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TOTAL_EMPLOYEES = 10000;

const EMPLOYEES: Employee[] = (() => {
  const rand = mulberry32(20260129);
  const rows: Employee[] = [];
  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    rows.push({
      id: `EMP-${String(i + 1).padStart(5, '0')}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + `${i + 1}@omni.example`,
      department: DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)],
      location: LOCATIONS[Math.floor(rand() * LOCATIONS.length)],
      employmentType: EMPLOYMENT_TYPES[Math.floor(rand() * EMPLOYMENT_TYPES.length)],
      jobTitle: TITLES[Math.floor(rand() * TITLES.length)],
    });
  }
  return rows;
})();

function matches(e: Employee, f: Filters): boolean {
  if (f.departments.length && !f.departments.includes(e.department)) return false;
  if (f.locations.length && !f.locations.includes(e.location)) return false;
  if (f.employmentTypes.length && !f.employmentTypes.includes(e.employmentType)) return false;
  const needle = f.search.trim().toLowerCase();
  if (needle && !e.name.toLowerCase().includes(needle) && !e.email.toLowerCase().includes(needle)) {
    return false;
  }
  return true;
}

// ------------------------------------------------------------- fake network ---

const LATENCY_MS = 220;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exactly what the real endpoint hands back: one page, plus a total count. */
export type PageResponse = {
  page: number;
  pageSize: number;
  employees: Employee[];
  totalCount: number;
};

export async function fetchEmployees(
  filters: Filters,
  page: number,
  pageSize: number,
): Promise<PageResponse> {
  await sleep(LATENCY_MS);
  const all = EMPLOYEES.filter((e) => matches(e, filters));
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const start = (clamped - 1) * pageSize;
  return {
    page: clamped,
    pageSize,
    employees: all.slice(start, start + pageSize),
    totalCount: all.length,
  };
}

/** Synchronous count, used to fill in the `totalCount` a select-all click captures. */
export function countMatching(filters: Filters): number {
  return EMPLOYEES.reduce((n, e) => (matches(e, filters) ? n + 1 : n), 0);
}

// ------------------------------------------------ the payload, and its truth ---

/**
 * The shape the frontend sends on submit. Mirrors the Notion tables:
 * `selectAll: true, filter: [A, B], exclude: [X1]`.
 */
export type SelectionPayload = {
  selectAll: boolean;
  /** One entry per select-all the user performed. Stacking strategies push more than one. */
  filters: Filters[];
  /** Individually ticked employees, on top of whatever the filters cover. */
  include: EmployeeId[];
  /** Individually unticked employees, removed from whatever the filters cover. */
  exclude: EmployeeId[];
};

/**
 * What the backend would really assign, given that payload. Union of every
 * select-all filter, plus explicit includes, minus explicit excludes.
 *
 * The frontend cannot compute this -- that is the entire problem -- so the
 * prototype only uses it to render the "actual" column beside the UI's guess.
 */
export function resolveSelection(payload: SelectionPayload): Set<EmployeeId> {
  const out = new Set<EmployeeId>();
  if (payload.selectAll) {
    for (const f of payload.filters) {
      for (const e of EMPLOYEES) if (matches(e, f)) out.add(e.id);
    }
  }
  for (const id of payload.include) out.add(id);
  for (const id of payload.exclude) out.delete(id);
  return out;
}

/** Ground truth for one row: would the backend consider it selected? */
export function isTrulySelected(payload: SelectionPayload, id: EmployeeId): boolean {
  if (payload.exclude.includes(id)) return false;
  if (payload.include.includes(id)) return true;
  if (!payload.selectAll) return false;
  const e = EMPLOYEES.find((x) => x.id === id);
  return e ? payload.filters.some((f) => matches(e, f)) : false;
}
