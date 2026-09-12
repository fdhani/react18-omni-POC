# Dependency-stack smoke test — React 18.3.1

Installed the following into the same React 18.3.1 repro and built dummy pages
exercising each library's riskiest surface, run through the same root-API /
StrictMode matrix used for `react-stack-grid` (`?cell=2|3|4`), in both `vite
dev` and a production build.

```
@material-ui/core     4.12.4          (requested ^4.11.0)
@material-ui/icons    4.11.3          (requested ^4.11.3)
@material-ui/lab      4.0.0-alpha.61  (requested ^4.0.0-alpha.61)
@material-ui/pickers  3.3.10          (requested ^3.2.10)
react-redux            7.2.9          (requested ^7.2.2)
@reduxjs/toolkit       1.6.2          (requested ^1.6.2, exact)
react-hook-form        6.13.1         (requested, exact)
react-virtualized      9.22.5         (requested ^9.22.3)
use-memo-one           1.1.2          (requested, exact — transitive)
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

### 1. `react-virtualized`'s default ESM build is broken under Vite/esbuild

Not a React version issue — a packaging bug. `react-virtualized`'s `module`
entry (`dist/es/index.js`) unconditionally re-exports `WindowScroller`, whose
compiled output is missing a Flow prop-type placeholder export
(`bpfrpt_proptype_WindowScroller`) that a sibling module still imports.
esbuild rejects this outright: **`vite dev` and `vite build` fail to even
start** as soon as anything is imported from `react-virtualized`'s default
entry point — regardless of which named export is actually used, and
regardless of React version.

```
✘ [ERROR] No matching export in ".../WindowScroller/WindowScroller.js"
  for import "bpfrpt_proptype_WindowScroller"
```

Standard workaround, applied here (`vite.config.ts`):

```ts
resolve: {
  alias: [
    { find: /^react-virtualized$/, replacement: 'react-virtualized/dist/commonjs/index.js' },
  ],
},
```

This routes around esbuild's stricter ESM export resolution by pointing at
the CommonJS build. Once aliased, the common `AutoSizer` + `List` combination
renders correctly under all three cells. `WindowScroller` itself was left out
of the demo — it's the actual source of the broken export and isn't needed to
answer "does the library work under React 18."

**If your build tool is Vite (or any esbuild-based bundler) and you plan to
use `react-virtualized`, you need this alias regardless of React version.**
Webpack historically tolerated the dead import and wouldn't have hit this.

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

## Bundle size

Adding this whole stack more than tripled the built JS: 256 KB → 828 KB
(gzip: 78 KB → 246 KB). Expected given `@material-ui/core` + `lab` + `pickers`
+ `moment` are all sizeable, and irrelevant to the React 18 question, but
worth knowing if this stack is heading to production as-is — `moment` and
MUI v4 in particular are commonly trimmed in real migrations (date-fns,
tree-shaken icon imports, MUI v5).

## Confidence

**High** that nothing in this stack crashes or misbehaves under React 18.3.1,
across both root APIs and both build modes — this was a direct, repeatable
render-and-inspect test, not an inference.

**Moderate** on the redux tearing result specifically — a negative result on
a race condition is only as strong as the workload used to look for it. If
this stack is going to production carrying real traffic patterns, I'd treat
"no tearing observed here" as encouraging, not conclusive.

**Not tested**: user interaction with each widget beyond initial mount (typing
into the date pickers, opening every menu/dialog repeatedly, submitting the
hook-form with invalid data to check validation-error rendering). This was a
mount/render smoke test, not a full interaction test of each library.
