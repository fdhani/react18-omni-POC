# Findings — react-stack-grid 0.7.1 under React 18.3.1

**Short answer: the concurrent-root hypothesis is not supported.**

A tear *does* happen on every reflow, it is real, and the browser really paints
it. But it happens identically under `createRoot` and under React 18's legacy
`ReactDOM.render` root — 2 stale frames, ~33 ms, 20–30 px displacement, on every
single width change, in both. Switching root API changes nothing.

Two things did turn up that are worth acting on, and neither is the flicker:

1. **StrictMode breaks the grid completely in development** — it renders zero
   cards. Distinct from, and worse than, a flicker.
2. With the library's *default* `duration={480}`, `createRoot` reproducibly adds
   **one extra stale frame** on the imperative path (~16 ms). Real, measured
   5/5 runs, but an order of magnitude smaller than the misalignment `duration`
   itself causes.

## How the hypothesis is tested without React 17

The matrix is React 18.3.1 throughout. **Cell 2 is the control**: React 18 running
the legacy `ReactDOM.render` root. React's own dev warning for that API reads
*"Until you switch to the new API, your app will behave as if it's running
React 17."* Cell 2 vs cell 3 therefore isolates exactly the variable the
hypothesis is about — concurrent root vs not — while holding the React version,
the bundle and the library fixed.

What this design cannot do is distinguish "pre-existing in React 17" from
"introduced in React 18 but present in both root APIs". Everything below is
scoped to React 18.

Environment: Chromium 1194 (headless), Playwright 1.49.1, Vite 5.4.11 production
builds unless stated, `react-stack-grid@0.7.1`, `react-sizeme@2.6.12`,
`element-resize-detector@1.2.4`, `react-transition-group@1.2.1`, installed with
npm `overrides` to bypass peer ranges.

---

## 1. Did the flicker reproduce?

Yes — in every cell, including the legacy-root control.

**Path A (container width change), production, `duration={0}`, 6 cards.**
17 width-change events per cell.

| Cell | Configuration | Torn frames | Stale frames med/max | Stale ms (med) | Visual jump px med/max |
|---|---|---|---|---|---|
| 2 | `ReactDOM.render` (control) | **17 / 17** | 2 / 2 | 33 | 20 / 30 |
| 3 | `createRoot` | **17 / 17** | 2 / 2 | 33 | 20 / 30 |
| 4 | `createRoot` + StrictMode | **17 / 17** | 2 / 2 | 33 | 20 / 30 |

Every single width change produced a torn frame, in every cell. The stale-frame
histogram is literally `{2: 17}` for each — the transforms are always exactly two
frames behind, never one, never three.

**Path B (imperative `updateLayout()` after async data), production, `duration={0}`.**

| Cell | Stale frames | Stale ms | Worst overlap px | Container overflow px |
|---|---|---|---|---|
| 2 | 1 | 16 | 96 | 0 |
| 3 | 1 | 17 | 96 | 0 |
| 4 | 1 | 16 | 96 | 0 |

One painted frame in which the grown card overlaps its neighbour by 96 px.
Identical under both root APIs.

Repeated with a 60-card grid to give a concurrent root something big enough to
yield on: **no change** — still `{2: 17}` and 20/30 px in every cell. Repeated
under `vite dev`: cells 2 and 3 identical to production.

### Independent confirmation that these frames are really painted

The rAF probe says "a frame was scheduled with stale transforms". A DevTools
trace says whether the compositor actually drew it. Marking `TEAR`/`SETTLE` from
the probe and counting paints between them:

| Cell | Tear windows | Windows containing a paint/frame | Paint events | DrawFrame/Commit |
|---|---|---|---|---|
| 2 (legacy root) | 11 | **11 / 11** | 322 | 88 |
| 3 (`createRoot`) | 11 | **11 / 11** | 317 | 88 |

The tear is genuinely painted — and just as genuinely painted without a
concurrent root.

## 2. Is it caused by the concurrent root?

**No.** Cell 2 has no concurrent root and is bit-for-bit as torn as cell 3.

The cause is upstream of React. `react-sizeme` wraps its measurement in
`throttle(16, …)` (`refreshRate: 16`, `refreshMode: 'throttle'`), and
`element-resize-detector`'s scroll strategy delivers its notification through its
own asynchronous batch processor. By the time `setState` is called at all, the
frame carrying the new container width has already been painted. Whether React
then flushes that update synchronously or schedules it changes nothing, because
React is not on the critical path for the first stale frame.

This also explains the suspiciously exact `{2: 17}`: the lag is structural (one
frame to deliver the resize, one to apply the update), not a scheduling race.

Per the spec's rendering steps, resize and scroll steps run *before*
`requestAnimationFrame` callbacks, so a synchronous flush inside the scroll
handler *would* have been visible to the probe as an untorn frame. It never was,
in any cell.

## 3. Path A vs Path B

They behave differently, but neither differentiates the root APIs at `duration={0}`.

- **Path A** — 2 stale frames, ~33 ms, cards displaced 20–30 px. Fires on every
  width change. Driven by the resize-detector pipeline.
- **Path B** — 1 stale frame, ~16 ms, but much uglier: a 96 px overlap between
  the grown card and its neighbour. Fires once per async load.

Path B's single stale frame is expected: `useEffect` is a passive effect and runs
after paint regardless of root API, so the grown card is painted once before
`updateLayout()` can reposition anything.

### The one place `createRoot` does differ

With the library's **default `duration={480}`**, Path B:

Across 8 runs:

| Cell | 1 stale frame | 2 stale frames | Severe anomaly (below) |
|---|---|---|---|
| 2 — `ReactDOM.render` | **8 / 8** | 0 | 0 |
| 3 — `createRoot` | 0 | **7 / 8** | 1 / 8 |
| 4 — `createRoot` + StrictMode | 0 | **7 / 8** | 1 / 8 |

Perfectly separated: the legacy root was 1 frame in every run, the concurrent
root was never 1 frame in any run. The concurrent root costs exactly one extra
stale frame (~16 ms) on this path. That is the hypothesis's mechanism, and it is
real — but it is one frame, it only appears once the library's own transition is
enabled, and it did not appear at all at `duration={0}` in any run.

Keep it in proportion. At `duration={480}` **every** cell paints ~34 overlapping
frames and ~29 frames where a card overflows the container on Path A, because
`duration` puts a 480 ms CSS transition on `transform` while the container height
snaps instantly:

| Cell | Overlap frames (A) | Overflow frames (A) | Overlap frames (B) | Overflow frames (B) |
|---|---|---|---|---|
| 2 | 35 | 30 | 27 | 55 |
| 3 | 34 | 29 | 28 | 54 |
| 4 | 34 | 29 | 29 | 53 |

**The `duration` prop causes ~30× more visible misalignment than the root API
does.** If the real dashboard looked janky, this is the far likelier culprit.

### An intermittent severe break, seen only under `createRoot`

Two of the 16 concurrent-root observations at `duration={480}` produced something
much worse than a one-frame lag: a painted frame with **296 px of card overlap**
and the container **386 px too short**, rather than the usual 96 px / 6 px.

It hit cell 4 once and cell 3 once, so it is not StrictMode-specific. It has
**never** been observed on the legacy root (0 of 8 runs).

| Root API | Observations | Severe anomalies |
|---|---|---|
| `ReactDOM.render` | 8 | **0** |
| `createRoot` (cells 3 + 4) | 16 | **2** |

Two occurrences is not enough to call this a result, and my analyzer measures it
over a degenerate one-frame window, so the magnitude may be overstated. But it is
the only effect in this whole investigation that is both concurrent-root-specific
and large enough for a user to notice, and it deserves a dedicated repro rather
than being written off. Treat it as the most promising open lead, not a finding.

## 4. Unexpected: StrictMode breaks the grid entirely (development only)

This is the real finding.

**Under `createRoot` + `StrictMode` in a development build, the grid renders zero
cards.** Not a flicker — nothing at all.

```
cell 3 (createRoot):            6 cards, grid height 992px, 3 erd containers
cell 4 (createRoot+StrictMode): 0 cards, grid height 0px,   5 erd containers
```

The container's only children are `element-resize-detector`'s own hidden
`erd_scroll_detection_container` elements. There are **five** of them where a
working grid has three: StrictMode's mount → unmount → remount installs the
detector twice, `react-sizeme`'s `componentWillUnmount` teardown does not undo
the first install, `react-sizeme` never receives a usable width, and it therefore
renders its placeholder forever and never renders any children.

The suspicion that the detector teardown would not survive a double-mount is
confirmed.

Downstream effects in the instrumentation: cell 4's Path A numbers in the dev run
(`lagFrames` median 113, max 186) are an artefact of an empty grid, not a
measurement of anything. Cell 4's Path B recorded no marks at all because the
async card never mounted. Both are symptoms of the same failure.

**Scope: development builds only.** React 18 only double-invokes mount effects in
DEV. A production build of cell 4 renders all 6 cards and behaves like cell 3:

```
PROD cell 2: cards=6 gridHeight=992px erdContainers=3
PROD cell 3: cards=6 gridHeight=992px erdContainers=3
PROD cell 4: cards=6 gridHeight=992px erdContainers=3
```

So it will not break production, but it does mean the team cannot run
`StrictMode` locally — the dashboard would simply be blank in dev.

### Development console (production builds compile these out)

Cell 2: `ReactDOM.render is no longer supported in React 18`, `findDOMNode is
deprecated`, `componentWillMount` / `componentWillReceiveProps` renamed warnings.
Cell 3: the same minus the `ReactDOM.render` warning.
Cell 4 adds: `findDOMNode was passed an instance of SizeMeReferenceWrapper which
is inside StrictMode`.

No errors, no exceptions, no infinite loops in any cell. Nothing crashed.

## 5. Confidence, and what would raise it

**High confidence** that the flicker is not caused by the concurrent root. The
legacy-root control tears identically, the numbers are stable across production,
dev, 6 cards and 60 cards, DevTools traces confirm real paints in both, and the
mechanism (16 ms throttle + async batcher, both upstream of React) explains the
exact value measured.

**High confidence** in the StrictMode finding. Deterministic, reproduced in every
dev run, with a concrete DOM-level mechanism (5 detector containers vs 3).

**Moderate-to-high confidence** in the `duration={480}` one-extra-frame result.
The two root APIs separated perfectly over 8 runs with no overlap. Still: one
frame, one browser, one machine, headless, and I did not isolate *why* the
transition changes scheduling behaviour.

**Low confidence** in the severe intermittent break. 2 occurrences in 16 runs,
measured over a degenerate window. Needs its own repro before anyone acts on it.

**Not established:** whether any of this differs from React 17. That comparison
was dropped from the repro at the maintainer's request, so "pre-existing" is an
inference from cell 2 behaving as React's own warning describes, not a
measurement in this repo.

What would make me more sure:

- A headed browser on real hardware. Headless Chromium's frame pacing is not the
  user's frame pacing, and a 1-frame effect is exactly the size that could move.
- More than one browser engine, and a throttled-CPU run — concurrent React yields
  under pressure, so a slow device is where a scheduling effect should be largest.
  Everything here ran on an unthrottled machine.
- Driving the resize by real pointer drag rather than `setViewportSize`, which
  changes the viewport in discrete jumps and may not reproduce the resize-event
  cadence of a user dragging a window edge.
- Pixel-diffing the screencast instead of trusting computed style. The rAF probe
  reads what *should* paint; the trace shows a paint *happened*; neither proves
  the painted pixels were wrong. The videos support it visually but I did not
  diff them frame by frame.
- The real dashboard's actual `duration`, `columnWidth` and card count. This repro
  uses `columnWidth="50%"`, which makes every pixel of width change move a card —
  deliberately the most sensitive configuration. A fixed px `columnWidth` only
  reflows when the column count changes, so it would tear far less often.

### If the goal is to stop the jank

Ranked by measured impact, none of which requires leaving React 18:

1. Set `duration={0}`. Removes ~30 of ~35 bad frames per resize. Biggest win by far.
2. Accept the 2-frame Path A lag or replace `react-sizeme` with a `ResizeObserver`
   wrapper, which delivers in the same frame rather than through a 16 ms throttle.
3. Do not enable `StrictMode` with this library until `react-sizeme` is replaced.
4. `createRoot` vs `ReactDOM.render` is worth one frame on one path. It is not
   the thing to fix — adopting the concurrent root is not what makes this grid
   janky.
