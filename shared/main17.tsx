import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App, { CELL } from './App';
import { probe } from './probe';

const container = document.getElementById('root')!;

// Cell 1: React 17 + ReactDOM.render -- the baseline control.
const MODE = 'react17 + ReactDOM.render';
(window as any).__MODE__ = MODE;
(window as any).__REACT_VERSION__ = React.version;
(window as any).__probe = probe;
probe.cell = '1';
probe.mode = MODE;
probe.start();

(ReactDOM as any).render(<App />, container);
