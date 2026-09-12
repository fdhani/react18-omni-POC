# react-stack-grid 0.7.1 × React 18 — reflow tear repro

A standalone, throwaway reproduction testing one hypothesis:

> `react-stack-grid@0.7.1` positions its children by measuring the DOM and then
> calling `setState`. Under a React 18 **concurrent root** (`createRoot`) that
> update is scheduled rather than flushed before paint, so the browser paints a
> frame where the container has already resized but the children still carry
> their previous `transform` — a visible flicker on every reflow.

**Result: the hypothesis is not supported.** The tear is real and measurable, but
it is *identical* under React 17, so it is pre-existing, not a React 18
regression. A separate and worse problem *was* found in `StrictMode`. See
[FINDINGS.md](./FINDINGS.md) for the numbers.

## Layout

```
shared/      one source tree used by both apps (App, probe, entrypoints)
app18/       React 18.3.1  — cells 2, 3, 4  (?cell=2|3|4)
app17/       React 17.0.2  — cell 1          (baseline control)
harness/     Playwright driver + offline analyzers
build-site.mjs  combines both builds into dist/ for static hosting
```

Both apps share `shared/` but pin `react` / `react-dom` to their own
`node_modules` via Vite aliases, so the two React versions never mix.

## Test matrix

| Cell | Root API | StrictMode | Purpose |
|---|---|---|---|
| 1 | React 17 `ReactDOM.render` | off | Baseline control |
| 2 | React 18 `ReactDOM.render` | off | Isolates "React 18" from "concurrent root" |
| 3 | React 18 `createRoot` | off | The hypothesis |
| 4 | React 18 `createRoot` | on | Double-invoked effects |

## Triggers

- **Path A — container width change.** `element-resize-detector` (scroll strategy)
  → react-sizeme `checkIfSizeChanged` → `getBoundingClientRect()` → `setState`,
  throttled at 16 ms. A `setState` originating outside React's event system.
- **Path B — imperative reflow.** A card resolves "data" after 800 ms, grows
  120 px, and calls `stackGridRef.updateLayout()` from a `useEffect`.
  Needed because StackGrid sets `monitorHeight: false`, so a child growing
  taller never triggers a reflow on its own.

## Instrumentation

`shared/probe.ts` runs a `requestAnimationFrame` loop recording, per frame, the
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
npm run install:all
npm run dev:18            # http://localhost:5173/?cell=3
npm run build             # combined static site into dist/
npm run measure           # Playwright, production build, all 4 cells
npm run analyze
```

Other harness configurations:

```bash
node harness/run.mjs prod 0 6      # mode(prod|dev)  duration  cards
node harness/run.mjs prod 480 6    # library default duration=480
node harness/run.mjs prod 0 60     # 60-card grid
node harness/run.mjs dev 0 6       # dev build (React warnings visible)
node harness/trace.mjs 3 4318      # DevTools trace: does a paint land in the tear?
```

### Query params

`?cell=1|2|3|4` · `&pathB=0|1` · `&duration=<ms>` (react-stack-grid transition,
default 0 here, library default 480) · `&cards=<n>` (default 6)

## Caveat on `duration`

`react-stack-grid`'s `duration` prop defaults to **480 ms** and applies a CSS
`transition` to `transform`. With the default, transforms lag the container by
design for ~480 ms on every reflow, which swamps any scheduling effect. The
matrix is therefore run at `duration={0}` to isolate the scheduling question;
`duration=480` is measured separately.
