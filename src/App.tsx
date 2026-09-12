import * as React from 'react';
import StackGrid from 'react-stack-grid';
import { probe } from './probe';

const BASE_HEIGHTS = [150, 320, 210, 400, 180, 260];
const GROW_INDEX = 2;
const GROW_BY = 120;
const RESOLVE_AFTER_MS = 800;

const params = new URLSearchParams(location.search);
export const CELL = params.get('cell') ?? '3';
export const PATH_B = params.get('pathB') !== '0';
export const DURATION = Number(params.get('duration') ?? '0');
// Number of cards. A larger grid makes React's render work non-trivial, which is
// where a concurrent root could plausibly yield and extend any tear.
export const N_CARDS = Number(params.get('cards') ?? '6');

const HEIGHTS: number[] = Array.from(
  { length: Number(new URLSearchParams(location.search).get('cards') ?? '6') },
  (_, i) => BASE_HEIGHTS[i % BASE_HEIGHTS.length],
);

type CardProps = {
  n: number;
  height: number;
  onGrow?: () => void;
};

function Card({ n, height }: CardProps) {
  return (
    <div
      data-card={n}
      style={{
        height,
        boxSizing: 'border-box',
        border: '3px solid #222',
        borderRadius: 8,
        background: n % 2 ? '#fdf3d8' : '#dceefb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 84px/1 system-ui, sans-serif',
        color: '#222',
      }}
    >
      {n}
    </div>
  );
}

/**
 * The async card: resolves its "data" after RESOLVE_AFTER_MS, grows by GROW_BY,
 * then asks the grid to reflow from a passive effect. This is Path B -- the
 * imperative `updateLayout()` path the real dashboard used, because
 * react-stack-grid sets monitorHeight:false and so never notices a child
 * growing taller on its own.
 */
function AsyncCard({ n, height, onLayout }: { n: number; height: number; onLayout: () => void }) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!PATH_B) return;
    const id = setTimeout(() => {
      probe.mark('B:data-resolved');
      setLoaded(true);
    }, RESOLVE_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    probe.mark('B:effect-ran');
    onLayout();
    probe.mark('B:updateLayout-called');
  }, [loaded]);

  return (
    <div
      data-card={n}
      style={{
        height: loaded ? height + GROW_BY : height,
        boxSizing: 'border-box',
        border: '3px solid #b00',
        borderRadius: 8,
        background: '#ffe3e3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 84px/1 system-ui, sans-serif',
        color: '#b00',
      }}
    >
      {n}
      <span style={{ font: '600 16px/1.4 system-ui, sans-serif' }}>
        {loaded ? 'data loaded (+120px)' : 'loading…'}
      </span>
    </div>
  );
}

const CELLS: Array<[string, string]> = [
  ['2', 'ReactDOM.render (control)'],
  ['3', 'createRoot'],
  ['4', 'createRoot + StrictMode'],
];

/**
 * In-page matrix switcher. The repro is a single Vite app served at the root, so
 * this replaces what used to be a separate generated landing page.
 */
function Nav() {
  const link = (params: Record<string, string>) => {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(params)) q.set(k, v);
    return `?${q.toString()}`;
  };
  const box: React.CSSProperties = {
    font: '13px/1.5 system-ui, sans-serif',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginBottom: 6,
  };
  const on: React.CSSProperties = { fontWeight: 700, textDecoration: 'none', color: '#111' };
  const off: React.CSSProperties = { color: '#0645ad' };
  return (
    <header style={{ marginBottom: 12 }}>
      <h1 style={{ font: '600 15px/1.4 system-ui, sans-serif', margin: '0 0 8px' }}>
        react-stack-grid 0.7.1 — cell <b data-cell>{CELL}</b> —{' '}
        <span data-mode>{(window as any).__MODE__}</span>
      </h1>
      <div style={box}>
        <span style={{ color: '#666' }}>cell:</span>
        {CELLS.map(([c, label]) => (
          <a key={c} href={link({ cell: c })} style={CELL === c ? on : off}>
            {c} — {label}
          </a>
        ))}
      </div>
      <div style={box}>
        <span style={{ color: '#666' }}>trigger:</span>
        <a href={link({ pathB: '0' })} style={PATH_B ? off : on}>Path A (resize)</a>
        <a href={link({ pathB: '1' })} style={PATH_B ? on : off}>Path B (async grow)</a>
        <span style={{ color: '#666', marginLeft: 8 }}>duration:</span>
        <a href={link({ duration: '0' })} style={DURATION === 0 ? on : off}>0</a>
        <a href={link({ duration: '480' })} style={DURATION === 480 ? on : off}>480 (library default)</a>
      </div>
      <div style={{ font: '12px/1.5 system-ui, sans-serif', color: '#666' }}>
        Per-frame probe on <code>window.__probe</code> — run{' '}
        <code>__probe.result()</code> in the console.
      </div>
    </header>
  );
}

export default function App() {
  const gridRef = React.useRef<any>(null);

  const updateLayout = React.useCallback(() => {
    gridRef.current?.updateLayout?.();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <Nav />
      <div style={{ maxWidth: 994, margin: '0 auto' }}>
        <StackGrid
          gridRef={(g: any) => {
            gridRef.current = g;
          }}
          columnWidth="50%"
          gutterWidth={24}
          gutterHeight={24}
          duration={DURATION}
          monitorImagesLoaded={false}
          appearDelay={0}
          component="div"
          itemComponent="div"
          className="the-grid"
        >
          {HEIGHTS.map((h, i) =>
            i === GROW_INDEX ? (
              <AsyncCard key={i} n={i + 1} height={h} onLayout={updateLayout} />
            ) : (
              <Card key={i} n={i + 1} height={h} />
            ),
          )}
        </StackGrid>
      </div>
    </div>
  );
}
