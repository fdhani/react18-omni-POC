import * as React from 'react';
import { CellSwitcher, ViewSwitcher } from '../Nav';
import { ErrorBoundary } from './ErrorBoundary';
import MuiCoreDemo from './MuiCoreDemo';
import MuiThemeDemo from './MuiThemeDemo';
import MuiLabDemo from './MuiLabDemo';
import MuiPickersDemo from './MuiPickersDemo';
import ReduxDemo from './ReduxDemo';
import ReactHookFormDemo from './ReactHookFormDemo';
import ReactVirtualizedDemo from './ReactVirtualizedDemo';

const SECTIONS: Array<[string, React.ComponentType]> = [
  ['mui-core', MuiCoreDemo],
  ['mui-theme', MuiThemeDemo],
  ['mui-lab', MuiLabDemo],
  ['mui-pickers', MuiPickersDemo],
  ['redux', ReduxDemo],
  ['react-hook-form', ReactHookFormDemo],
  ['react-virtualized', ReactVirtualizedDemo],
];

/**
 * Dependency-stack smoke test: mounts a dummy page exercising the riskiest
 * surface of each library in the requested stack, wrapped in per-section error
 * boundaries so one crash doesn't hide the results of the others. Root API and
 * StrictMode are selected the same way as the stack-grid repro (?cell=2|3|4),
 * reusing main.tsx's root setup. Results land on window.__libResults for
 * Playwright to read after the page settles.
 */
export default function LibSmokeTest() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ font: '600 15px/1.4 system-ui, sans-serif', margin: '0 0 8px' }}>
          Dependency-stack smoke test — <span data-mode>{(window as any).__MODE__}</span>
        </h1>
        <ViewSwitcher />
        <CellSwitcher />
        <div style={{ font: '12px/1.5 system-ui, sans-serif', color: '#666' }}>
          Per-section results on <code>window.__libResults</code> — inspect it{' '}
          in the console.
        </div>
      </header>
      {SECTIONS.map(([name, Demo]) => (
        <section key={name}>
          <h2 style={{ font: '600 13px/1.4 system-ui, sans-serif', color: '#555' }}>{name}</h2>
          <ErrorBoundary name={name}>
            <Demo />
          </ErrorBoundary>
        </section>
      ))}
    </div>
  );
}
