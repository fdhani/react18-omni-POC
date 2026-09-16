import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CELL } from './App';
import { AppRoutes } from './routes';
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
// The probe drives a permanent requestAnimationFrame loop and only means
// anything on the repro route, so prototypes on other paths never start it.
if (location.pathname === '/') probe.start();

function Root() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

if (CELL === '2') {
  (ReactDOM as any).render(<Root />, container);
} else if (CELL === '4') {
  createRoot(container).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
} else {
  createRoot(container).render(<Root />);
}
