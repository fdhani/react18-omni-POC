# react-stack-grid 0.7.1 × React 18 — reflow tear repro

A standalone, throwaway reproduction testing one hypothesis, on **React 18.3.1 only**:

> `react-stack-grid@0.7.1` positions its children by measuring the DOM and then
> calling `setState`. Under a React 18 **concurrent root** (`createRoot`) that
> update is scheduled rather than flushed before paint, so the browser paints a
> frame where the container has already resized but the children still carry
> their previous `transform` — a visible flicker on every reflow.

**Result: the hypothesis is not supported.** The tear is real, measurable, and
really painted — but it is identical under `createRoot` and under the legacy
`ReactDOM.render` root. See [FINDINGS.md](./FINDINGS.md).

A separate and worse problem *was* found in `StrictMode`.

## Test matrix

All cells are React 18.3.1. **Cell 2 is the control**: React 18 running the
legacy `ReactDOM.render` root, which React itself warns will *"behave as if it's
running React 17"*. Cell 2 vs cell 3 is therefore a direct isolation of
"concurrent root" from "React 18".

| Cell | Root API | StrictMode | Purpose |
|---|---|---|---|
| 2 | `ReactDOM.render` (legacy root) | off | Control — React 18 without a concurrent root |
| 3 | `createRoot` | off | The hypothesis |
| 4 | `createRoot` | on | Double-invoked effects |

## Layout

```
src/         app source (App, per-frame probe, entrypoint, route table)
src/poc/     standalone prototypes, one directory per route
harness/     Playwright driver + offline analyzers (own package.json)
```

A single Vite app at the repository root. It is deliberately **not** in a
subdirectory: Vercel auto-detects a nested Vite app as the project Root
Directory, which silently changes which `package.json` its build command runs
against.

## Routes

`react-router-dom` `BrowserRouter`, wired in `src/main.tsx` inside whichever
root the `?cell=` switch selected, so every prototype runs under the same three
root configurations as the repro.

| Path | What |
|---|---|
| `/` | The repro above. Still entirely query-string driven, so `harness/` is unaffected. |
| `/poc-bulk-action-pagination` | Prototype: paginated select-all in Add Entitlement (see below). |

Prototypes under `src/poc/` import nothing from the repro and own their state,
styles and mock data, so they can be deleted or lifted out on their own. The
per-frame probe starts only on `/` — it drives a permanent `requestAnimationFrame`
loop and means nothing anywhere else.

Deep links need the SPA fallback in `vercel.json` (`rewrites`), or
`/poc-bulk-action-pagination` 404s on a hard refresh in production.

### `/poc-bulk-action-pagination`

Prototype of the Proposal in *Problem: Assign Employee with paginated
select-all in Add Entitlement* (Notion, under Ad Hoc Time Off FE), built on MUI.

It is the Add Entitlement step-2 employee picker: 10,000 employees behind a
paginated, combinably-filtered mock endpoint that only ever returns one page and
a `totalCount`, so select-all has to be sent as intent rather than as a list of
ids. The rules it implements are the doc's:

- select-all captures the filter on screen, and the payload carries that filter
  rather than the ids behind it;
- select-alls never stack — clicking it again clears everything and captures the
  current filter, so a count is never a sum of totals and nobody is counted
  twice;
- includes and excludes sit on top and survive paging.

Each row also carries a publish status — `published` or `unpublished` — and a
kebab menu offering the one action that applies to it: Unpublish on a published
row, Publish on an unpublished one, never both and never a disabled no-op. The
change goes through the mock backend and the row is patched with what comes
back, rather than refetching the page: a refetch would flash the table for a
one-field change and could reshuffle rows under someone midway through ticking
them. Publishing never touches the selection.

Alongside the picker the prototype shows the payload the frontend would submit
and an action log in the doc's own columns (action, BE return, FE payload, count
in UI), with one column the doc could only reason about: what the backend would
actually assign for that payload. The doc's three Problem Simulation
walkthroughs are replay buttons. Two of them are the sequences that miscounted
when select-alls stacked; under the Proposal all three hold, the last step
landing on 1,673 / 303 / 1,731 in both columns.

What the Proposal costs is visible in the table. Because the selection survives
a filter change, a row's checkbox is genuinely unresolvable while the filter on
screen is not the captured one — the frontend holds a filter and a count, not a
membership list. Those rows render as indeterminate rather than as a confident
tick, and the banner offers to re-capture the current filter. Closing that
properly needs a product decision: render unknown, have the list endpoint return
a per-row `selected` flag, or clear the selection on filter change.

The route is lazily loaded, so MUI stays out of the repro's bundle at `/`.

## Triggers

- **Path A — container width change.** `element-resize-detector` (scroll strategy)
  → react-sizeme `checkIfSizeChanged` → `getBoundingClientRect()` → `setState`,
  throttled at 16 ms. A `setState` originating outside React's event system.
- **Path B — imperative reflow.** A card resolves "data" after 800 ms, grows
  120 px, and calls `stackGridRef.updateLayout()` from a `useEffect`.
  Needed because StackGrid sets `monitorHeight: false` (`StackGrid.js:463-464`),
  so a child growing taller never triggers a reflow on its own.

## Instrumentation

`src/probe.ts` runs a `requestAnimationFrame` loop recording, per frame, the
container's measured width/height alongside every child's computed `transform`
and box size. Exposed as `window.__probe`; call `window.__probe.result()` in the
console.

A **torn frame** is a frame whose container width differs from the previous
frame while the children's transforms are unchanged from the previous frame.

rAF callbacks run *after* the spec's resize and scroll steps and immediately
before paint, so what the probe reads is what that frame paints.

Because "one torn frame" is the floor for *any* async measure-then-`setState`
design, `harness/analyze.mjs` reports the more discriminating metric: for each
width change, **how many frames** the transforms stayed stale, and how far the
cards jumped when they caught up. A concurrent-scheduling regression should show
up as a longer tail here.

## Running it

```bash
npm install               # the app
npm --prefix harness install   # Playwright, only needed to measure
npm run dev               # http://localhost:5173/?cell=3
npm run build             # static site into dist/
npm run measure           # Playwright, production build, all 3 cells
npm run analyze
npm run verify            # assert a built dist/ renders every cell
```

Other harness configurations:

```bash
node harness/run.mjs prod 0 6      # mode(prod|dev)  duration  cards
node harness/run.mjs prod 480 6    # library default duration=480
node harness/run.mjs prod 0 60     # 60-card grid
node harness/run.mjs dev 0 6       # dev build (React warnings visible)
node harness/trace.mjs 3           # DevTools trace: does a paint land in the tear?
```

### Query params

`?cell=2|3|4` · `&pathB=0|1` · `&duration=<ms>` (react-stack-grid transition,
default 0 here, library default 480) · `&cards=<n>` (default 6)

## Caveat on `duration`

`react-stack-grid`'s `duration` prop defaults to **480 ms** and applies a CSS
`transition` to `transform`. With the default, transforms lag the container by
design for ~480 ms on every reflow, which swamps any scheduling effect. The
matrix is therefore run at `duration={0}` to isolate the scheduling question;
`duration=480` is measured separately.

## Deploying

Zero-config static Vite SPA. From the repo root:

```bash
vercel --prod          # or: Import the repo in the Vercel dashboard
```

**Vercel's Root Directory must be the repository root (`./`).** If it is set to
a subdirectory the build runs against the wrong `package.json` and fails with
`Missing script`. `vercel.json` pins `framework: vite`, `buildCommand: npm run
build`, `outputDirectory: dist`.

The build is `vite build`, so what deploys is the **production** bundle —
React's development warnings are compiled out, and StrictMode does not
double-invoke effects (so cell 4 renders normally in production; the StrictMode
failure below is a development-build symptom).

Routes on the deployed site — the page carries an in-page switcher, so `/` is
enough to reach everything:

| Cell | URL |
|---|---|
| default (cell 3) | `/` |
| 2 — legacy root (control) | `/?cell=2&pathB=1` |
| 3 — `createRoot` | `/?cell=3&pathB=1` |
| 4 — `createRoot` + StrictMode | `/?cell=4&pathB=1` |

Swap `pathB=1` for `pathB=0` to test Path A (resize) instead, and append
`&duration=480` to see the library's default transition.

## Evidence

`evidence/` holds the distilled analyses, run logs and confirmation videos.
Raw per-frame dumps and DevTools traces are gitignored (1.5–12 MB each);
regenerate them with `npm run measure` and `node harness/trace.mjs 3`.
