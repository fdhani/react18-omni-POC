import * as React from 'react';
import List from 'react-virtualized/dist/commonjs/List';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import { useMemoOne } from 'use-memo-one';
import 'react-virtualized/styles.css';
import { MountTracker, libResults } from './ErrorBoundary';

const ROWS = Array.from({ length: 200 }, (_, i) => `Row ${i}`);

// react-virtualized is effectively unmaintained and predates ResizeObserver.
//
// Its default ESM entry (`import { List } from 'react-virtualized'`, resolving
// to dist/es/index.js) unconditionally re-exports WindowScroller, whose
// compiled output is missing a Flow prop-type placeholder export
// (bpfrpt_proptype_WindowScroller) that a sibling module still imports.
// Confirmed empirically (both React 17 and React 18, same Vite 5.4.11):
//   - `vite dev`  (esbuild dependency pre-bundling): hard error, dev server
//                 never starts, regardless of React version.
//   - `vite build` (Rollup): only a console warning, build still succeeds,
//                 also regardless of React version.
// So the bug is real and React-version-independent, but not universally
// fatal -- it depends on which of Vite's two bundlers (esbuild for dev,
// Rollup for build) is doing the resolving, and on whether the barrel
// export is touched at all.
//
// Deep-importing each component (as done here) bypasses the broken barrel
// entirely: no error in dev, no warning in build, on any React version. This
// is the standard fix for this issue and is simpler than aliasing the whole
// package in vite.config.ts to its CommonJS build (also confirmed to work,
// but implies a project-wide config change for one library).
export default function ReactVirtualizedDemo() {
  React.useEffect(() => {
    const r = libResults['react-virtualized'];
    if (r) {
      r.notes.push(
        'Imported via deep paths (react-virtualized/dist/commonjs/List, ' +
          '.../AutoSizer) rather than the package barrel -- avoids a confirmed ' +
          'esbuild/Rollup packaging bug in the barrel export (see source comment). ' +
          'Empirically independent of React version: same failure under React 17.',
      );
    }
  }, []);

  // Exercises the use-memo-one transitive dependency directly: a stable,
  // React-version-agnostic memoized row renderer.
  const rowRenderer = useMemoOne(
    () =>
      ({ index, key, style }: any) => (
        <div key={key} style={style} data-row={index}>
          {ROWS[index]}
        </div>
      ),
    [],
  );

  return (
    <div data-demo="react-virtualized" style={{ height: 220 }}>
      <MountTracker name="react-virtualized" />
      <AutoSizer disableHeight>
        {({ width }: { width: number }) => (
          <List height={220} rowCount={ROWS.length} rowHeight={28} rowRenderer={rowRenderer} width={width} />
        )}
      </AutoSizer>
    </div>
  );
}
