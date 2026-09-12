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

Also included: a **dependency-stack smoke test** for a wider set of at-risk
libraries (MUI v4, react-redux, react-hook-form, react-virtualized, and more)
under this same React 18.3.1 setup — `?cell=3&libs=1`. See
[DEPENDENCY-STACK.md](./DEPENDENCY-STACK.md).

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
src/         app source (App, per-frame probe, entrypoint)
harness/     Playwright driver + offline analyzers (own package.json)
```

A single Vite app at the repository root. It is deliberately **not** in a
subdirectory: Vercel auto-detects a nested Vite app as the project Root
Directory, which silently changes which `package.json` its build command runs
against.

Installed with npm `overrides` to bypass the peer ranges of `react-sizeme` and
`react-transition-group`, which do not declare React 18 support:

```
react-stack-grid@0.7.1          peer react: >=15.3.0
  ├─ react-sizeme@2.6.12        peer react: ^0.14 || ^15 || ^16
  │    └─ element-resize-detector@1.2.4   (scroll strategy, not ResizeObserver)
  └─ react-transition-group@1.2.1  peer react: ^15 || ^16
```

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

## Dependency-stack smoke test

`src/libtests/` mounts a dummy page per library (`LibSmokeTest.tsx`, reached
via `?libs=1`) under the same `?cell=2|3|4` root-API matrix. Each demo is
wrapped in its own error boundary (`ErrorBoundary.tsx`) so one crash doesn't
hide the others, and mount/unmount counts + free-form notes land on
`window.__libResults` for automated inspection.

```bash
npm run libcheck        # node harness/libcheck.mjs prod -- production build, all 3 cells
node harness/libcheck.mjs dev   # dev build, to see React's dev-only warnings
```

See [DEPENDENCY-STACK.md](./DEPENDENCY-STACK.md) for what was tested and what
was found — short version: nothing crashes under React 18, but
`react-virtualized` needs a Vite alias workaround (unrelated to React
version) and `react-hook-form@6`'s types don't resolve under modern
`moduleResolution: bundler`.
