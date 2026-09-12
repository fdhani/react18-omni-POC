import * as React from 'react';
import { List, AutoSizer, type ListRowRenderer } from 'react-virtualized';
import { useMemoOne } from 'use-memo-one';
import 'react-virtualized/styles.css';
import { MountTracker, libResults } from './ErrorBoundary';

const ROWS = Array.from({ length: 200 }, (_, i) => `Row ${i}`);

// react-virtualized is effectively unmaintained and predates ResizeObserver.
// Two independent risks tested here: (1) does the common AutoSizer+List combo
// actually render under React 18, and (2) does Vite's esbuild-based bundler
// even resolve the package at all -- a known, React-version-independent
// ecosystem issue. WindowScroller is deliberately NOT used here: it fails the
// Vite/esbuild build outright (see note below), confirmed separately and
// recorded in libResults rather than worked around.
export default function ReactVirtualizedDemo() {
  React.useEffect(() => {
    const r = libResults['react-virtualized'];
    if (r) {
      r.notes.push(
        'react-virtualized/WindowScroller excluded from this demo: its dist/es ' +
          'build re-exports a Flow prop-type placeholder ' +
          '(bpfrpt_proptype_WindowScroller) that does not exist in the compiled ' +
          'output, which esbuild rejects outright -- `vite dev` and `vite build` ' +
          'both fail to even start with WindowScroller imported. Confirmed by a ' +
          'separate standalone build attempt, independent of React version.',
      );
    }
  }, []);

  // Exercises the use-memo-one transitive dependency directly: a stable,
  // React-version-agnostic memoized row renderer.
  const rowRenderer: ListRowRenderer = useMemoOne(
    () =>
      ({ index, key, style }) => (
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
        {({ width }) => (
          <List height={220} rowCount={ROWS.length} rowHeight={28} rowRenderer={rowRenderer} width={width} />
        )}
      </AutoSizer>
    </div>
  );
}
