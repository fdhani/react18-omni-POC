/**
 * Mock backend for the BIR 2316 bulk publish prototype.
 *
 * Models the employee table from [PH-BIR-01..07] BIR 2316 Tax form generation:
 * employees applicable to a selected tax year, behind a paginated, filterable
 * endpoint. The dataset lives here, not in the UI — the page is only ever handed
 * one page of rows plus a `totalCount`, which is why "select all" has to travel
 * as intent rather than as a list of ids.
 *
 * Two endpoints exist that a real backend would have to grow, and they are the
 * point of the prototype:
 *
 *   selectionSummary — how many rows in this selection can actually be
 *                      published / unpublished? The frontend cannot compute it.
 *   bulkSetPublished — apply the action to the eligible rows only, and report
 *                      what was skipped and why.
 */

export type EmployeeId = string;

export const TAX_YEARS = [2026, 2025, 2024] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

/** Profile fields BIR 2316 needs. A form missing any of them cannot be published (PH-BIR-06.1). */
export const REQUIRED_FIELDS = ['TIN', 'RDO code', 'Registered address', 'Date of birth'] as const;

export type Employee = {
  id: EmployeeId;
  name: string;
  email: string;
  department: string;
  location: string;
  tin: string | null;
  /** Mandatory fields absent from the profile. Empty means the form is complete. */
  missingFields: string[];
};

/**
 * What the row's form is, derived rather than stored:
 *
 *   not_generated — forms have not been generated for this tax year yet
 *   missing_info  — generated, but mandatory information is absent, so it
 *                   cannot be published or downloaded (PH-BIR-03.5, PH-BIR-06.1)
 *   unpublished   — generated and complete; publishable
 *   published     — visible to the employee, and read-only until unpublished
 */
export type FormStatus = 'not_generated' | 'missing_info' | 'unpublished' | 'published';

export type EmployeeRow = Employee & { status: FormStatus };

/** Only location and department are filterable, plus free-text search. */
export type Filters = {
  departments: string[];
  locations: string[];
  search: string;
  /** Quick view for the rows a bulk publish would have to skip. */
  missingInfoOnly: boolean;
};

export const EMPTY_FILTERS: Filters = {
  departments: [],
  locations: [],
  search: '',
  missingInfoOnly: false,
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
  'Manila',
  'Cebu',
  'Davao',
  'Quezon City',
  'Makati',
  'Remote',
] as const;

export function filtersAreEmpty(f: Filters): boolean {
  return (
    f.departments.length === 0 &&
    f.locations.length === 0 &&
    f.search.trim() === '' &&
    !f.missingInfoOnly
  );
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  const sameList = (x: string[], y: string[]) =>
    x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
  return (
    sameList(a.departments, b.departments) &&
    sameList(a.locations, b.locations) &&
    a.search.trim().toLowerCase() === b.search.trim().toLowerCase() &&
    a.missingInfoOnly === b.missingInfoOnly
  );
}

/** Short human label for a filter set, e.g. "Engineering + Makati". */
export function describeFilters(f: Filters): string {
  if (filtersAreEmpty(f)) return 'No filter (all employees)';
  const parts = [...f.departments, ...f.locations];
  if (f.missingInfoOnly) parts.push('missing info');
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
  const rand = mulberry32(20260916);
  const rows: Employee[] = [];
  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    // ~9% of profiles are short of something the form needs.
    const missingFields: string[] = [];
    if (rand() < 0.06) missingFields.push('TIN');
    if (rand() < 0.03) missingFields.push('RDO code');
    if (rand() < 0.02) missingFields.push('Date of birth');
    const digits = () => String(Math.floor(rand() * 900) + 100);
    rows.push({
      id: `EMP-${String(i + 1).padStart(5, '0')}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + `${i + 1}@omni.example`,
      department: DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)],
      location: LOCATIONS[Math.floor(rand() * LOCATIONS.length)],
      tin: missingFields.includes('TIN') ? null : `${digits()}-${digits()}-${digits()}-000`,
      missingFields,
    });
  }
  return rows;
})();

// ------------------------------------------------------------- form records ---

/**
 * Forms are per employee per tax year, and only exist once the admin has run
 * the one global "Generate forms" action (PH-BIR-01.5 — everything is
 * snapshotted at that point).
 */
const generatedYears = new Set<TaxYear>();
const publishedByYear = new Map<TaxYear, Set<EmployeeId>>();

function publishedSet(year: TaxYear): Set<EmployeeId> {
  let s = publishedByYear.get(year);
  if (!s) {
    s = new Set();
    publishedByYear.set(year, s);
  }
  return s;
}

export function isGenerated(year: TaxYear): boolean {
  return generatedYears.has(year);
}

function statusOf(e: Employee, year: TaxYear): FormStatus {
  if (!generatedYears.has(year)) return 'not_generated';
  if (e.missingFields.length > 0) return 'missing_info';
  return publishedSet(year).has(e.id) ? 'published' : 'unpublished';
}

function withStatus(e: Employee, year: TaxYear): EmployeeRow {
  return { ...e, status: statusOf(e, year) };
}

// ------------------------------------------------------------- query engine ---

function matches(e: Employee, f: Filters, year: TaxYear): boolean {
  if (f.departments.length && !f.departments.includes(e.department)) return false;
  if (f.locations.length && !f.locations.includes(e.location)) return false;
  if (f.missingInfoOnly && statusOf(e, year) !== 'missing_info') return false;
  const needle = f.search.trim().toLowerCase();
  if (needle && !e.name.toLowerCase().includes(needle) && !e.email.toLowerCase().includes(needle)) {
    return false;
  }
  return true;
}

function resultSet(f: Filters, year: TaxYear): Employee[] {
  return EMPLOYEES.filter((e) => matches(e, f, year));
}

// ------------------------------------------------------------- fake network ---

const LATENCY_MS = 220;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type PageResponse = {
  page: number;
  pageSize: number;
  employees: EmployeeRow[];
  totalCount: number;
};

export async function fetchEmployees(
  year: TaxYear,
  filters: Filters,
  page: number,
  pageSize: number,
): Promise<PageResponse> {
  await sleep(LATENCY_MS);
  const all = resultSet(filters, year);
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const start = (clamped - 1) * pageSize;
  return {
    page: clamped,
    pageSize,
    employees: all.slice(start, start + pageSize).map((e) => withStatus(e, year)),
    totalCount: all.length,
  };
}

export function countMatching(filters: Filters, year: TaxYear): number {
  return resultSet(filters, year).length;
}

// --------------------------------------------------- selection and its truth ---

/**
 * The selection, as sent to the backend. `filter` is singular: a select-all
 * replaces the previous one rather than stacking, so there is never a list of
 * filters to union.
 */
export type SelectionPayload = {
  selectAll: boolean;
  filter: Filters | null;
  include: EmployeeId[];
  exclude: EmployeeId[];
};

function resolve(payload: SelectionPayload, year: TaxYear): Employee[] {
  const ids = new Set<EmployeeId>();
  if (payload.selectAll && payload.filter) {
    for (const e of resultSet(payload.filter, year)) ids.add(e.id);
  }
  for (const id of payload.include) ids.add(id);
  for (const id of payload.exclude) ids.delete(id);
  return EMPLOYEES.filter((e) => ids.has(e.id));
}

export function resolveSelection(payload: SelectionPayload, year: TaxYear): Set<EmployeeId> {
  return new Set(resolve(payload, year).map((e) => e.id));
}

export type PublishAction = 'publish' | 'unpublish';

/**
 * How a selection breaks down for each action.
 *
 * This is the number the bulk menu needs and the frontend cannot work out: it
 * holds a filter and a count, and the statuses of rows it has never fetched are
 * unknowable. One round trip, so "Publish" can say how many it will really act
 * on before the admin commits.
 */
export type SelectionSummary = {
  total: number;
  /** Generated, complete, currently unpublished. */
  publishable: number;
  /** Generated and currently published. */
  unpublishable: number;
  /** Generated but missing mandatory information — skipped by publish, with a reason. */
  missingInfo: number;
  /** No form for this tax year yet. */
  notGenerated: number;
};

export async function selectionSummary(
  payload: SelectionPayload,
  year: TaxYear,
): Promise<SelectionSummary> {
  await sleep(LATENCY_MS);
  const rows = resolve(payload, year);
  const summary: SelectionSummary = {
    total: rows.length,
    publishable: 0,
    unpublishable: 0,
    missingInfo: 0,
    notGenerated: 0,
  };
  for (const e of rows) {
    switch (statusOf(e, year)) {
      case 'not_generated':
        summary.notGenerated++;
        break;
      case 'missing_info':
        summary.missingInfo++;
        break;
      case 'published':
        summary.unpublishable++;
        break;
      case 'unpublished':
        summary.publishable++;
        break;
    }
  }
  return summary;
}

export type BulkResult = {
  action: PublishAction;
  affected: number;
  skippedAlreadyInState: number;
  skippedMissingInfo: number;
  skippedNotGenerated: number;
};

/**
 * Apply the action to the eligible rows only. Publishing never touches a row
 * that is already published or missing information; unpublishing never touches
 * one that is not published. Eligibility is decided here, at execution time,
 * against live state — not from whatever the client last saw.
 */
export async function bulkSetPublished(
  payload: SelectionPayload,
  year: TaxYear,
  action: PublishAction,
): Promise<BulkResult> {
  const rows = resolve(payload, year);
  // Stand-in for real work. A production version of this at 10,000 rows would
  // have to be a job rather than a request.
  await sleep(LATENCY_MS + Math.min(1400, rows.length * 0.4));
  const published = publishedSet(year);
  const result: BulkResult = {
    action,
    affected: 0,
    skippedAlreadyInState: 0,
    skippedMissingInfo: 0,
    skippedNotGenerated: 0,
  };
  for (const e of rows) {
    const status = statusOf(e, year);
    // The missing-info and not-generated buckets only mean something for
    // publish. For unpublish those rows are simply not published, and reporting
    // them separately would contradict the preview the admin just confirmed.
    if (status === 'not_generated') {
      if (action === 'publish') result.skippedNotGenerated++;
      else result.skippedAlreadyInState++;
      continue;
    }
    if (status === 'missing_info') {
      if (action === 'publish') result.skippedMissingInfo++;
      else result.skippedAlreadyInState++;
      continue;
    }
    const isPublished = status === 'published';
    if ((action === 'publish') === isPublished) {
      result.skippedAlreadyInState++;
      continue;
    }
    if (action === 'publish') published.add(e.id);
    else published.delete(e.id);
    result.affected++;
  }
  return result;
}

/** Row-level publish/unpublish from the kebab menu. */
export async function setPublished(
  id: EmployeeId,
  year: TaxYear,
  published: boolean,
): Promise<EmployeeRow> {
  await sleep(LATENCY_MS);
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) throw new Error(`no such employee: ${id}`);
  if (published) publishedSet(year).add(id);
  else publishedSet(year).delete(id);
  return withStatus(e, year);
}

/** PH-BIR-01: one global action that snapshots forms for every applicable employee. */
export async function generateForms(year: TaxYear): Promise<void> {
  await sleep(LATENCY_MS + 600);
  generatedYears.add(year);
}

/** PH-BIR-01.5.1: "Reset all" deletes every generated form for the tax year. */
export async function resetForms(year: TaxYear): Promise<void> {
  await sleep(LATENCY_MS);
  generatedYears.delete(year);
  publishedByYear.delete(year);
}
