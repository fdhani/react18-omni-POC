# Dependency-stack smoke test — React 18.3.1

Installed the following into the same React 18.3.1 repro and built dummy pages
exercising each library's riskiest surface, run through the same root-API /
StrictMode matrix used for `react-stack-grid` (`?cell=2|3|4`), in both `vite
dev` and a production build.

```
@material-ui/core       4.12.4          (requested ^4.11.0)
@material-ui/icons      4.11.3          (requested ^4.11.3)
@material-ui/lab        4.0.0-alpha.61  (requested ^4.0.0-alpha.61)
@material-ui/pickers    3.3.10          (requested ^3.2.10)
react-redux              7.2.9          (requested ^7.2.2)
@reduxjs/toolkit         1.6.2          (requested ^1.6.2, exact)
@tanstack/react-query    4.36.1         (real app's pinned version — the "react-query" package)
react-hook-form          6.13.1         (requested, exact)
react-virtualized        9.22.5         (requested ^9.22.3)
use-memo-one             1.1.2          (requested, exact — transitive)
```

Try it: `?cell=3&libs=1` (add `&cell=2` for the legacy root, `&cell=4` for
`createRoot`+StrictMode).

## Result: nothing breaks under React 18.3.1 at runtime

All six demos (MUI core, MUI lab, MUI pickers, redux, react-hook-form,
react-virtualized) mount cleanly, in dev and in production, under all three
root/StrictMode configurations. **Zero console errors or warnings in the
production build**, in any cell. Every section survives StrictMode's
double-mount without error — unlike `react-sizeme` in the stack-grid repro,
none of these libraries' effect teardown breaks on remount.

| | Cell 2 (legacy root) | Cell 3 (`createRoot`) | Cell 4 (`createRoot`+StrictMode) |
|---|---|---|---|
| All 6 demos mount | ✅ | ✅ | ✅ |
| Production console errors | 0 | 0 | 0 |
| Production console warnings | 0 | 0 | 0 |
| Page errors (crashes) | 0 | 0 | 0 |

## Peer dependencies: need `overrides`, same story as `react-stack-grid`

None of these declare React 18 support except `react-redux@7.2.9` (`^16.8.3 ||
^17 || ^18`) and `react-virtualized@9.22.5` (`^15.3.0 || ^16.0.0-alpha ||
^17.0.0 || ^18.0.0`) — both explicitly permit it. Everything else (`@material-ui/*`,
`@reduxjs/toolkit`, `react-hook-form`, `use-memo-one`) is capped at `^17.0.0`.
Installing with `npm install` alone fails with `ERESOLVE` (a nested
`@types/react` peerOptional conflict from `@material-ui/icons`); adding
`overrides` for `react`/`react-dom`/`@types/react`/`@types/react-dom` (same
pattern as the stack-grid repro) resolves cleanly with a single deduped React
copy throughout — confirmed via `npm ls`.

## Two real, confirmed issues — neither is a React-18-crash

### 1. `react-virtualized`'s default ESM build is broken — confirmed independent of React version

Not a React issue — a packaging bug, and I verified this claim directly rather
than just asserting it: the exact same test was rerun in two isolated
throwaway apps, one pinned to React 17.0.2 and one to React 18.3.1, both on
the identical Vite version (5.4.11) used everywhere else in this repo.

`react-virtualized`'s `module` entry (`dist/es/index.js`) unconditionally
re-exports `WindowScroller`, whose compiled output is missing a Flow
prop-type placeholder export (`bpfrpt_proptype_WindowScroller`) that a
sibling module still imports:

```
✘ [ERROR] No matching export in ".../WindowScroller/WindowScroller.js"
  for import "bpfrpt_proptype_WindowScroller"
```

The precise, confirmed behavior — identical on React 17 and React 18:

| | `vite dev` (esbuild dep pre-bundling) | `vite build` (Rollup) |
|---|---|---|
| `import { List } from 'react-virtualized'` (barrel) | **hard error, dev server never starts** | only a console warning, build still succeeds |
| Deep import, e.g. `import List from 'react-virtualized/dist/commonjs/List'` | clean, no error | clean, no warning |

So the bug is real, but it's neither universally fatal nor React-version-gated
— it depends on (a) which of Vite's two bundlers is doing the resolving
(esbuild for `dev`, Rollup for `build`), and (b) whether the broken barrel
export is ever touched. **If another Vite + React app "just works" with
`react-virtualized`, the likely explanation is that it deep-imports each
component (or only ever runs `vite build`, never `vite dev`, against it) —
not that it's on an earlier React version.**

The fix applied here: deep-import each component directly, bypassing the
broken barrel entirely —

```ts
import List from 'react-virtualized/dist/commonjs/List';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
```

No `vite.config.ts` changes needed at all. (A project-wide alias to the
CommonJS build, `{ find: /^react-virtualized$/, replacement:
'react-virtualized/dist/commonjs/index.js' }`, also works and was the first
fix tried — but it's a bigger hammer than necessary for a bug caused by one
broken re-export.) `WindowScroller` itself was left out of the demo — it's
the actual source of the broken export and isn't needed to answer "does the
library work under React 18."

**If your build tool is Vite (or any esbuild-based bundler) and you plan to
use `react-virtualized`'s barrel import in dev mode, you'll hit this
regardless of React version.** Webpack historically tolerated the dead import
and wouldn't have hit this at all.

### 2. `react-hook-form@6.13.1`'s types don't resolve under modern TS

Not a runtime issue — a type-checking one. Its `package.json` `exports` map
has an `import`/`require` condition but no `types` condition:

```json
"exports": { ".": { "import": "./dist/index.esm.js", "require": "./dist/index.js" } }
```

Under `moduleResolution: "bundler"` (or `"node16"`/`"nodenext"`), TypeScript
respects the `exports` map strictly and won't fall back to the package's
top-level `"types": "dist/index.d.ts"` field the way the older `"node"`
resolution mode did. Result: `tsc --noEmit` fails with
`Could not find a declaration file for module 'react-hook-form'`, even though
the types genuinely exist in the package and Vite/esbuild resolve the
JavaScript just fine at runtime.

Worked around here with a local `declare module 'react-hook-form';` stub
(see `src/types.d.ts`) — acceptable for a smoke test, but a real team
adopting this version under a modern TS config would either need the same
stub (losing type safety on the form) or to pin `moduleResolution: "node"`
project-wide.

## Redux tearing: none observed

`react-redux@7.2.9` predates `useSyncExternalStore` (added in v8) and instead
uses its own subscription + forced re-render mechanism — the documented risk
under React 18 concurrent rendering is "tearing," where two components
reading the same store value could momentarily disagree.

Tested by dispatching ~400 rapid updates from a raw `setInterval` (deliberately
outside any React event handler, the scenario most likely to expose a batching
gap) while two sibling components render the same selector, and probing every
animation frame for disagreement between them — same per-frame methodology as
the stack-grid repro's torn-frame detector.

**Result: 0 torn frames across ~150 observed frames, in every cell**,
including the legacy root. No tearing observed under this workload.

Caveat, consistent with the stack-grid findings: this ran on an unthrottled,
headless browser. Tearing bugs are a race condition — absence of evidence
here is not strong evidence of absence for a slower device or a heavier
render tree. It's the reason `react-redux` v8 added
`useSyncExternalStore` support in the first place; a library-level guarantee
beats an empirical spot-check.

## React Query: actually tested, not just peer-range-checked

Earlier in this investigation, React Query was only checked at the peer
metadata level (`@tanstack/react-query@4.36.1`'s range already permits React
18). That's a fact about a `package.json`, not a runtime test — this closes
the gap with the real thing: a `QueryClientProvider` + `useQuery` (two
sibling components reading the same cached query) + `useMutation` calling
`setQueryData` (the optimistic-update pattern the dependency-upgrade
investigation names in §8.8 as the React Query replacement for a Redux
domain's reducer), run through the identical tearing-probe methodology
already used for `react-redux`.

**Notably, `@tanstack/react-query@4.36.1` depends directly on
`use-sync-external-store`** — unlike `react-redux@7` (which predates it and
uses its own subscription mechanism), React Query v4 already uses React's
own official concurrent-safe subscription primitive. This is a structurally
stronger starting position than `react-redux`'s, not just an equivalent one,
and the results bear that out:

- **0 torn frames across ~120 observed frames, in every cell**, same as redux.
- **The query function was invoked exactly once, in every cell — including
  `createRoot`+StrictMode.** React 18 StrictMode deliberately double-invokes
  effects specifically to surface side-effect bugs like a data fetch firing
  twice; React Query's cache correctly deduped it. This is a stronger,
  actually-measured result than an inference from the peer range or from
  "it uses `useSyncExternalStore`" alone.
- The mutation (`setQueryData`) correctly propagated to both cache readers,
  confirmed after an actual click, in every cell.
- Zero console errors or warnings in production, all three cells.

## react-hook-form + Controller + MUI: the realistic integration point

The earlier `react-hook-form` demo only tested the uncontrolled `register()`
pattern. Given MUI is used in 2,431 files and RHF in 788 in the real app,
the realistic integration point is almost certainly `Controller` wrapping
MUI's *controlled* inputs — a materially different code path, tested here
with `TextField`, `Select`, `Autocomplete`, and a `KeyboardDatePicker` all
wired through the same form.

`react-hook-form@6`'s `Controller` has a different render-prop signature
than v7's — `render={(field, state) => ...}` where `field` is directly
spreadable (`onChange`/`onBlur`/`value`/`name`/`ref`), not nested under a
`field` key as in v7's `render={({ field }) => ...}`. This is one concrete,
verified instance of the "breaking v6-to-v7 API migration" the
dependency-upgrade investigation names — the two versions are not drop-in
compatible at this exact call site, confirmed by reading `react-hook-form`'s
own compiled type declarations, not assumed from the version-number jump
alone.

**Result: filled every controlled field and submitted, in every cell** —
correct values came back for the plain `TextField`, the `Select`, the
`Autocomplete` (its default `null`), and the `KeyboardDatePicker`
(`2026-09-12`), all through the `Controller` render-prop path. Zero console
errors in production.

One test-harness bug caught along the way, not a library issue: the first
attempt to fill the `TextField` failed silently because the check targeted
MUI's outer `FormControl` wrapper div (where a `data-check` prop passed to
`TextField` actually lands), not the inner `<input>` Playwright's `fill()`
needs — confirmed by inspecting the rendered DOM, not assumed. Fixed by
targeting `input` inside that wrapper.

## Forward risk (React 19), not a React 18 problem

Dev-mode console shows two deprecation warnings, both compiled out of
production and both still functional under React 18:

- `@material-ui/pickers` (`PickerWithState`, `ModalWrapper2`) sets
  `defaultProps` on function components — warned in React 18, **removed in
  React 19**.
- MUI core's `ButtonBase` (used by `Button`) triggers a `findDOMNode`
  deprecation warning — same removal timeline.

Same pattern as `react-stack-grid`'s dependency chain: these libraries work
today, but a future React 19 migration would need all of them replaced or
patched, not just upgraded.

## MUI v4 theme/JSS integrity under React 18

The initial smoke test only proved MUI v4 *installs and mounts* under React 18
— it never touched what the dependency-upgrade investigation actually
identified as the risk: a customized theme, JSS `overrides`, and the specific
API surface it flagged by file count (§6 of that investigation). This section
tests that directly: a representative theme with custom palette/breakpoints/
shadows/typography, `defaultProps`, and JSS `overrides` for the exact 8
components the investigation names (Alert, Autocomplete, Paper, Tooltip,
Avatar, LinearProgress, Modal, Stepper) — not the real theme, which this
session has no access to, but built to the same shape.

Also covers the specific breaking-change API usages the investigation counted
by file (`labelWidth`, `GridList`, `gridGap`, `disableTypography`,
`fontSize="default"`), a JSS `&$active` conditional-selector composition
(exercised through an actual click, not just initial render), and the picker
stack with a Luxon adapter and `Keyboard*` picker variants, matching the
investigation's note about "a custom Luxon adapter of roughly 350 lines"
more closely than the plain-Moment pickers tested earlier (also required
technically — `@material-ui/pickers` v3's typings tie the whole TypeScript
program to one date-library adapter, so both picker demos now use Luxon).

**Every check verifies via `getComputedStyle` after mount that the override
actually took visual effect** — not just that nothing crashed. Two of the
eight initially came back "FAIL"; both turned out to be mistakes in the test
itself, not MUI/React 18 bugs, and are worth recording precisely since they
illustrate exactly the "component DOM changes can invalidate overrides
without a compile error" risk the investigation describes in the abstract:

- **`MuiAvatar`**: the override targeted the `root` class key; the actual
  background color lives on `colorDefault`, applied alongside `root` only
  when there's no image. Confirmed by inspecting the rendered class list
  (`MuiAvatar-root MuiAvatar-circular MuiAvatar-colorDefault`), not assumed.
- **`MuiBackdrop`**: a bare `<Modal open>`'s *default* backdrop is
  `SimpleBackdrop`, a separate internal component with hardcoded inline
  styles that deliberately never goes through `withStyles`/the theme at all.
  The theme-aware `Backdrop` only appears if `BackdropComponent={Backdrop}`
  is passed explicitly.

After fixing both (in the test, not in MUI), **all 8 named overrides apply
correctly, in all three cells** (legacy root, `createRoot`, `createRoot` +
StrictMode), confirmed by computed style, not appearance:

```
ok MuiAlert override, MuiAutocomplete override, MuiPaper override,
   MuiTooltip override, MuiAvatar override, MuiLinearProgress override,
   MuiBackdrop (Modal) override, MuiStepper override   — all 3 cells
```

The JSS `&$active` conditional composition also works correctly through an
actual state-driven re-render (not just at initial mount) in all three cells
— `borderWidth: 4px → 2px` on click, confirmed via Playwright, in every cell.

### JSS style-injection integrity under StrictMode

This is the direct analogue of the `react-sizeme` bug already found in the
`react-stack-grid` repro (a resize-detector's teardown not surviving React
18's double-mount) — does JSS's own `<style data-jss>` sheet manager survive
the same double-mount cleanly, leak duplicates, or drop sheets?

**Result: `createRoot` and `createRoot`+StrictMode produce the *identical*
sheet count (56) and the identical set of per-component duplicates.**
StrictMode's double-invoke does not add or leak a single extra JSS sheet —
unlike `react-sizeme`, JSS's teardown is StrictMode-safe.

(The baseline duplication itself — several components like `MuiButtonBase`,
`MuiTextField`, `MuiDialog` each showing exactly 2 sheets — is normal JSS
behavior, present identically in *all three* cells including the legacy
root: JSS emits a separate sheet for static vs. dynamic/prop-dependent rules
per component. Not a defect, not React-18-specific.)

One reproducible (3/3 runs), minor difference did turn up: the **legacy
root consistently shows 58 sheets versus 56 for `createRoot`**, with one
extra `MuiTouchRipple` duplicate that never appears under `createRoot`. Zero
console errors, no visual difference detected, and the root cause wasn't
traced further (would require digging into `ButtonBase`/`TouchRipple`'s
internal timing) — recorded as an observed, deterministic curiosity, not a
finding either direction. If anything, it says legacy-root creates *more*
incidental JSS activity than `createRoot`, not less.

## Closing the API-usage gap: matched against the real theme.ts/material.d.ts

After the section above, the real app's actual theme structure and
`material.d.ts` module-augmentation targets were described directly (not the
files themselves — this session still has no access to the real repo). That
description named several theme keys, override targets, and styling APIs
the smoke test hadn't touched at all. Closed every one of them:

| Item | Real app's usage | Tested here |
|---|---|---|
| Custom top-level `shadow` key | `main`/`button`/`box`/`hover`, requires augmenting `Theme`/`ThemeOptions` themselves | ✅ added, augmented `@material-ui/core/styles`, read back via `useTheme()` |
| `shape.borderRadius` | present in `theme.ts` | ✅ added, read back via `useTheme()` |
| Richer custom palette types | `icon`, `calendarBackground`, `filter`, `inputBackground`, extended `background` | ✅ added `IconOption`/`CalendarPaletteOption`/`Filter` types + extended `TypeBackground`, all consumed and verified via computed style |
| `MuiDivider` override | in `overrides` | ✅ |
| Stepper sub-component set | `MuiStepConnector`, `MuiStepIcon` (custom component), `MuiStepLabel` | ✅ `MuiStepConnector`/`MuiStepLabel` overrides + a real custom `StepIcon` component (swaps icon/color by active/completed/default state) |
| `props: { MuiAlert, MuiModal, MuiTooltip }` | `theme.ts` | ✅ set on the exact three components (not the arbitrary pair tested earlier), plus a `ComponentsPropsList` augmentation for `MuiAlert` (a Lab component) |
| `ComponentsPropsList` augmentation | `material.d.ts` | ✅ |
| `GlobalStyles.tsx` | `src/view/theme/` | ✅ approximated with `withStyles({'@global': {...}})`, the standard v4 pattern for exactly this |
| Plain CSS coexisting with JSS (`ReactSlickStyles.css`) | `src/view/theme/` | ✅ installed `react-slick` + `slick-carousel`, added a custom override `.css` file layered on the library's own CSS plus a JSS-styled sibling element, verified cascade order survives intact |
| `useTheme` (37 files) | — | ✅ |
| `createStyles` (11 files) | — | ✅ |
| `styled` (8 files) | — | ✅ |
| `withStyles` (2 files) | — | ✅ (via the custom `StepIcon` and `GlobalStyles`) |

**Result: everything above works correctly under React 18, verified by
computed style (not appearance), in all three cells** — legacy root,
`createRoot`, and `createRoot`+StrictMode alike. Zero console errors or
warnings in production throughout.

Three checks initially failed; all three were bugs in the test, not in MUI
or React 18, and are worth recording precisely because each is exactly the
"a component/props change can silently invalidate a class-key override"
risk this investigation keeps naming — just self-inflicted this time,
by my own changes, rather than a v4→v5 migration:

- Adding `props.MuiAlert.variant = 'filled'` silently switched Alert's
  rendered class from `standardSuccess` to `filledSuccess` — the override
  written against the old default stopped applying. Fixed by targeting the
  class the new default variant actually renders (confirmed by inspecting
  the rendered class list, not assumed).
- Narrowing `theme.props` down to the real app's exact three components
  (removing an arbitrary `MuiTextField: { variant: 'outlined' }` tested
  earlier) silently reverted the Autocomplete demo's `TextField` to the
  default underline variant, so the override's target class
  (`.MuiOutlinedInput-root`) stopped existing at all. Fixed by setting
  `variant="outlined"` explicitly at the call site instead of relying on a
  theme default.
- `MuiStepLabel`'s `label` override applies correctly on the *default*
  step state, but MUI's own `active`/`completed` state classes also set
  `color` and win the cascade for those two states specifically — overriding
  the base class key isn't enough when a state-specific key touches the
  same property. Fixed by also setting `active`/`completed` in the override.

Not tested: `MuiThemeProvider`/`StylesProvider`/`CssBaseline` — correctly
skipped, since the real app doesn't use any of them either (0 files).

## Bundle size

Adding this whole stack (now including `react-slick`/`slick-carousel` and
the expanded theme) grew the built JS to 824 KB (gzip ~252 KB) plus a 16 KB
stylesheet (slick's own CSS + the custom override file). Expected given
`@material-ui/core` + `lab` + `pickers` + a carousel library are all
sizeable, and irrelevant to the React 18 question, but worth knowing if this
stack is heading to production as-is — MUI v4 in particular is commonly
trimmed in real migrations (tree-shaken icon imports, MUI v5).

## Confidence

**High** that nothing in this stack crashes or misbehaves under React 18.3.1,
across both root APIs and both build modes — this was a direct, repeatable
render-and-inspect test, not an inference.

**High** that a *representative* customized MUI v4 theme survives React 18
intact — verified via computed style, in all three cells, including one full
click-driven re-render through JSS's dynamic composition path, not just
static mount. This now matches the real theme.ts/material.d.ts's actual
described shape directly (custom top-level `shadow` key with its own
`Theme`/`ThemeOptions` augmentation, `shape`, the richer custom palette
types, `props` on the exact three components used, the full Stepper
sub-component set including a custom `StepIcon`, global JSS styles, and a
plain-CSS-plus-JSS coexistence test) rather than an approximation of it —
every named theme key, override target, and styling API (`useTheme`,
`createStyles`, `styled`, `withStyles`) has now been exercised at least once.

**Moderate-to-high** on React Query specifically — higher than the redux
tearing result, because it isn't only a negative result (no tearing
observed): the StrictMode double-fetch check is a positive, structural
confirmation (exactly one fetch, when a bug would have produced two), and
`use-sync-external-store` gives it a design-level reason to expect this
result, not just an empirical one. Still: one workload, one browser,
unthrottled.

**Moderate** on the redux tearing result specifically — a negative result on
a race condition is only as strong as the workload used to look for it. If
this stack is going to production carrying real traffic patterns, I'd treat
"no tearing observed here" as encouraging, not conclusive.

**High** on `react-hook-form@6.13.1` + `Controller` + MUI's controlled
inputs — a full fill-and-submit cycle through `TextField`, `Select`,
`Autocomplete`, and a `KeyboardDatePicker`, verified end to end, in every
cell. This is the realistic integration pattern given the two libraries'
overlapping file counts in the real app, not the simpler uncontrolled
`register()` case tested earlier.

**Not tested — the remaining gap**: the *real* theme's actual values,
selectors, and the ~145 shared atoms/molecules it names as coupled to MUI.
This session has no access to the actual Omni Frontend repo — every key,
override target, and augmentation now matches what was *described*, built
from scratch with placeholder values, not copied from the real
`theme.ts`/`material.d.ts`. It also doesn't cover global `.Mui*` selectors
targeting component internals from outside the theme (a distinct mechanism
from the JSS `overrides`/`props` machinery tested here), or any interaction
between the real theme's actual values and the app's real component tree.
A representative theme with the right *shape* surviving React 18 is
meaningfully more evidence than either the initial default-styled smoke test
or an inference from reading the investigation doc — but it is still not
the same claim as "the production theme survives," and closing that gap
fully requires the real files.

**Not tested**: user interaction with each widget beyond initial mount and the
handful of clicks/fills added so far (opening every menu/dialog repeatedly,
submitting a form with *invalid* data to check validation-error rendering,
typing into the date pickers rather than only reading their default value).
Still a mount/render + a few targeted interactions per library, not a full
interaction test of each one.

**Not tested**: `react-hook-form@7` itself, or the v6→v7 migration — only
confirmed that v6's `Controller` signature differs from v7's by reading the
type declarations, not that upgrading actually works. Also untested: React
Query's own breaking migration (v4→v5, which is the version the dependency-
upgrade investigation says requires React 18-or-newer), pagination, retries,
`useInfiniteQuery`, and query invalidation across multiple keys — the smoke
test here covers one query key and one mutation, not the library's broader
surface.
