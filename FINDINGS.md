# Findings

**Short answer: the hypothesis as stated is not supported.**

A tear *does* happen on every reflow, it is real, and the browser really paints
it. But it happens identically under React 17 `ReactDOM.render`, React 18
`ReactDOM.render` and React 18 `createRoot`. It is a property of how
`react-sizeme` / `element-resize-detector` deliver the resize, not of React's
scheduler, so **it is pre-existing, not a React 18 regression.**

Two things did turn up that are worth acting on, and neither is the flicker:

1. **StrictMode breaks the grid completely in development** — it renders zero
   cards. Distinct from, and worse than, a flicker.
2. With the library's *default* `duration={480}`, `createRoot` reproducibly adds
   **one extra stale frame** on the imperative path (16 ms). Real, measured, but
   an order of magnitude smaller than the misalignment `duration` itself causes.

Environment: Chromium 1194 (headless), Playwright 1.49.1, Vite 5.4.11 production
builds unless stated, `react-stack-grid@0.7.1`, `react-sizeme@2.6.12`,
`element-resize-detector@1.2.4`, `react-transition-group@1.2.1`.

---

## 1. Did the flicker reproduce?

Yes — in every cell, including the React 17 control.

**Path A (container width change), production, `duration={0}`, 6 cards.**
17 width-change events per cell.

| Cell | Configuration | Torn frames | Stale frames med/max | Stale ms (med) | Visual jump px med/max |
|---|---|---|---|---|---|
| 1 | React 17.0.2 `ReactDOM.render` | **17 / 17** | 2 / 2 | 33 | 20 / 30 |
| 2 | React 18.3.1 `ReactDOM.render` | **17 / 17** | 2 / 2 | 33 | 20 / 30 |
| 3 | React 18.3.1 `createRoot` | **17 / 17** | 2 / 2 | 33 | 20 / 30 |
| 4 | React 18.3.1 `createRoot` + StrictMode | **17 / 17** | 2 / 2 | 33 | 20 / 30 |

Every single width change produced a torn frame, in all four cells. The
stale-frame histogram is literally `{2: 17}` for every cell — the transforms are
always exactly two frames behind, never one, never three.

**Path B (imperative `updateLayout()` after async data), production, `duration={0}`.**

| Cell | Stale frames | Stale ms | Worst overlap px | Container overflow px |
|---|---|---|---|---|
| 1 | 1 | 16 | 96 | 0 |
| 2 | 1 | 16 | 96 | 0 |
| 3 | 1 | 17 | 96 | 0 |
| 4 | 1 | 16 | 96 | 0 |

One painted frame in which the grown card overlaps its neighbour by 96 px.
Identical in React 17.

Repeated with a 60-card grid to give a concurrent root something big enough to
yield on: **no change** — still `{2: 17}` and 20/30 px in every cell. Repeated
under `vite dev`: cells 1–3 identical to production.

### Independent confirmation that these frames are really painted

The rAF probe says "a frame was scheduled with stale transforms". A DevTools
trace says whether the compositor actually drew it. Marking `TEAR`/`SETTLE` from
the probe and counting paints between them:

| Cell | Tear windows | Windows containing a paint/frame | Paint events | DrawFrame/Commit |
|---|---|---|---|---|
| 1 (React 17) | 11 | **11 / 11** | 321 | 88 |
| 2 (React 18 legacy) | 11 | **11 / 11** | 322 | 88 |
| 3 (React 18 createRoot) | 11 | **11 / 11** | 317 | 88 |

The tear is genuinely painted — and just as genuinely painted under React 17.

## 2. Is it a React 18 regression?

**No.** The stated test was "only claim yes if cell 1 is clean and cell 3 is
not". Cell 1 is not clean; it is bit-for-bit as torn as cell 3.

The cause is upstream of React. `react-sizeme` wraps its measurement in
`throttle(16, …)` (`refreshRate: 16`, `refreshMode: 'throttle'`), and
`element-resize-detector`'s scroll strategy delivers its notification through its
own asynchronous batch processor. By the time `setState` is called at all, the
frame carrying the new container width has already been painted. Whether React
then flushes that update synchronously or schedules it changes nothing, because
React is not on the critical path for the first stale frame.

This also explains the suspiciously exact `{2: 17}`: the lag is structural (one
frame to deliver the resize, one to apply the update), not a scheduling race.

Per the spec's rendering steps, resize and scroll steps run *before* `requestAnimationFrame`
callbacks, so a synchronous React 17 flush inside the scroll handler *would* have
been visible to the probe as an untorn frame. It never was.

## 3. Path A vs Path B

They behave differently, but neither differentiates React versions at `duration={0}`.

- **Path A** — 2 stale frames, ~33 ms, cards displaced 20–30 px. Fires on every
  width change. Driven by the resize-detector pipeline.
- **Path B** — 1 stale frame, ~16 ms, but much uglier: a 96 px overlap between
  the grown card and its neighbour. Fires once per async load.

Path B's single stale frame is exactly what the brief predicted: `useEffect` is a
passive effect and runs after paint in React 17 too. Confirmed — cell 1 tears
identically.

### The one place `createRoot` does differ

With the library's **default `duration={480}`**, Path B:

| Cell | run 1 | run 2 | run 3 | run 4 |
|---|---|---|---|---|
| 1 — React 17 | 1 frame | 1 | 1 | 1 |
| 2 — React 18 legacy | 1 frame | 1 | 1 | 1 |
| 3 — React 18 `createRoot` | **2 frames** | **2** | **2** | **2** |
| 4 — `createRoot` + StrictMode | 2 frames | 2 | *anomaly* | 2 |

Reproducible 4/4: the concurrent root costs exactly one extra stale frame
(~16 ms) on this path. That is the hypothesis's mechanism, and it is real — but
it is one frame, it only appears once the library's own transition is enabled,
and it did not appear at all at `duration={0}` in any run.

Keep it in proportion. At `duration={480}` **every** cell, React 17 included,
paints ~34 overlapping frames and ~29 frames where a card overflows the
container on Path A, because `duration` puts a 480 ms CSS transition on
`transform` while the container height snaps instantly:

| Cell | Overlap frames (A) | Overflow frames (A) | Overlap frames (B) | Overflow frames (B) |
|---|---|---|---|---|
| 1 | 34 | 29 | 27 | 55 |
| 2 | 35 | 30 | 27 | 55 |
| 3 | 35 | 28 | 29 | 53 |
| 4 | 34 | 29 | 29 | 53 |

**The `duration` prop causes ~30× more visible misalignment than the scheduling
difference does, and it does so on React 17 exactly as much as on React 18.**
If the real dashboard looked janky, this is the far likelier culprit.

One run of cell 4 at `duration={480}` produced a much worse break — 296 px
overlap, 386 px container overflow. It did not reproduce in the other three runs,
so treat it as an unexplained one-off rather than a result.

## 4. Unexpected: StrictMode breaks the grid entirely (development only)

This is the real finding, and it is the one the brief guessed at.

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

That is exactly the suspicion in the brief — the detector teardown does not
survive a double-mount — and it is confirmed.

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

Cell 1 (React 17): `componentWillMount`, `componentWillReceiveProps` renamed warnings.
Cell 2 adds: `ReactDOM.render is no longer supported in React 18`, `findDOMNode is deprecated`.
Cell 4 adds: `findDOMNode was passed an instance of SizeMeReferenceWrapper which is inside StrictMode`.

No errors, no exceptions, no infinite loops in any cell. Nothing crashed.

## 5. Confidence, and what would raise it

**High confidence** that the flicker is not a React 18 concurrent-root
regression. Three independent lines agree, the React 17 control is clean-running
and tears identically, the numbers are stable across production, dev, 6 cards and
60 cards, and the mechanism (16 ms throttle + async batcher, both upstream of
React) explains the exact value measured.

**High confidence** in the StrictMode finding. Deterministic, reproduced in every
dev run, with a concrete DOM-level mechanism (5 detector containers vs 3).

**Moderate confidence** in the `duration={480}` one-extra-frame result. It
reproduced 4/4 with no counterexample, but it is a single frame on one browser,
one machine, headless, and I did not isolate *why* the transition changes
scheduling behaviour.

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
   the thing to fix.
