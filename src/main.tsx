import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import App, { CELL } from './App';
import { probe } from './probe';

const container = document.getElementById('root')!;

// Cell 2: React 18 + legacy ReactDOM.render (no concurrent root)
// Cell 3: React 18 + createRoot          (concurrent root)
// Cell 4: React 18 + createRoot + StrictMode
const MODE =
  CELL === '2'
    ? 'react18 + ReactDOM.render (legacy root)'
    : CELL === '4'
      ? 'react18 + createRoot + StrictMode'
      : 'react18 + createRoot';

(window as any).__MODE__ = MODE;
(window as any).__REACT_VERSION__ = React.version;
(window as any).__probe = probe;
probe.cell = CELL;
probe.mode = MODE;
probe.start();

if (CELL === '2') {
  (ReactDOM as any).render(<App />, container);
} else if (CELL === '4') {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} else {
  createRoot(container).render(<App />);
}
