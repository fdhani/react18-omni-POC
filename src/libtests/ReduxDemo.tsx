import * as React from 'react';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { MountTracker, libResults } from './ErrorBoundary';

// react-redux@7 predates useSyncExternalStore (added in v8) and instead relies
// on its own subscription + forceUpdate mechanism. The classic risk under React
// 18 concurrent rendering is "tearing": two components reading the same store
// value could momentarily disagree if a store update lands mid-render. We force
// updates from OUTSIDE React's event system (a raw setInterval, not a click
// handler) -- the scenario batching/tearing bugs show up in -- and use a
// per-frame probe (same method as the stack-grid repro) to check whether two
// sibling components ever render different values in the same painted frame.

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    tick: (state) => {
      state.value += 1;
    },
  },
});

const store = configureStore({ reducer: { counter: counterSlice.reducer } });

function Reader({ id }: { id: string }) {
  const value = useSelector((s: any) => s.counter.value);
  return <span data-redux-reader={id}>{value}</span>;
}

function ExternalDispatcher() {
  const dispatch = useDispatch();
  React.useEffect(() => {
    // Deliberately outside any React event handler / lifecycle callback that
    // React's event system would batch on its own in <18 legacy-root mode.
    let n = 0;
    const id = setInterval(() => {
      dispatch(counterSlice.actions.tick());
      n++;
      if (n > 400) clearInterval(id);
    }, 4);
    return () => clearInterval(id);
  }, [dispatch]);
  return null;
}

function TearProbe() {
  React.useEffect(() => {
    let raf = 0;
    let tornFrames = 0;
    let frames = 0;
    let prevA: string | null = null;
    let prevB: string | null = null;
    let sameCount = 0;
    const tick = () => {
      const a = document.querySelector('[data-redux-reader="a"]')?.textContent ?? null;
      const b = document.querySelector('[data-redux-reader="b"]')?.textContent ?? null;
      if (a !== null && b !== null) {
        frames++;
        if (a !== b) tornFrames++;
        if (a === prevA && b === prevB) sameCount++;
        prevA = a;
        prevB = b;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => {
      cancelAnimationFrame(raf);
      const r = libResults['redux'];
      if (r) {
        r.notes.push(`frames observed: ${frames}`);
        r.notes.push(`torn frames (readers disagreed): ${tornFrames}`);
        r.notes.push(`final counter value: ${(store.getState() as any).counter.value}`);
      }
    }, 2500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stop);
    };
  }, []);
  return null;
}

export default function ReduxDemo() {
  return (
    <Provider store={store}>
      <div data-demo="redux">
        <MountTracker name="redux" />
        <ExternalDispatcher />
        <TearProbe />
        reader A: <Reader id="a" /> &nbsp; reader B: <Reader id="b" />
      </div>
    </Provider>
  );
}
