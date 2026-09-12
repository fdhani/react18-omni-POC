import * as React from 'react';
import { CELL, LIBS, linkWith } from './params';

const CELLS: Array<[string, string]> = [
  ['2', 'ReactDOM.render (control)'],
  ['3', 'createRoot'],
  ['4', 'createRoot + StrictMode'],
];

export const rowStyle: React.CSSProperties = {
  font: '13px/1.5 system-ui, sans-serif',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'baseline',
  marginBottom: 6,
};
const on: React.CSSProperties = { fontWeight: 700, textDecoration: 'none', color: '#111' };
const off: React.CSSProperties = { color: '#0645ad' };
const linkStyle = (active: boolean) => (active ? on : off);

/** Which of the two entry points is showing, with a link to the other one --
 * the two pages otherwise have no way to reach each other. */
export function ViewSwitcher() {
  return (
    <div style={rowStyle}>
      <span style={{ color: '#666' }}>page:</span>
      <a href={linkWith({ libs: '0' })} style={linkStyle(!LIBS)}>
        stack-grid repro
      </a>
      <a href={linkWith({ libs: '1' })} style={linkStyle(LIBS)}>
        dependency-stack smoke test
      </a>
    </div>
  );
}

/** Root-API / StrictMode matrix switcher, shared by both pages since which
 * cell is selected is decided once in main.tsx before either page mounts. */
export function CellSwitcher() {
  return (
    <div style={rowStyle}>
      <span style={{ color: '#666' }}>cell:</span>
      {CELLS.map(([c, label]) => (
        <a key={c} href={linkWith({ cell: c })} style={linkStyle(CELL === c)}>
          {c} — {label}
        </a>
      ))}
    </div>
  );
}
