import * as React from 'react';

export type LibResult = {
  name: string;
  status: 'pending' | 'ok' | 'error';
  error?: string;
  mounts: number;
  unmounts: number;
  notes: string[];
};

// Shared results object Playwright reads off `window.__libResults` after the
// page settles. Populated by MountTracker (success path) and ErrorBoundary
// (failure path) for every demo section.
export const libResults: Record<string, LibResult> = {};
(window as any).__libResults = libResults;

export function reportNote(name: string, note: string) {
  libResults[name]?.notes.push(note);
}

// Class component: error boundaries have no hook equivalent in React 18.
export class ErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
    libResults[props.name] = { name: props.name, status: 'pending', mounts: 0, unmounts: 0, notes: [] };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const r = libResults[this.props.name];
    if (r) {
      r.status = 'error';
      r.error = `${error.message}\n${info.componentStack ?? ''}`.slice(0, 2000);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ border: '2px solid #c00', padding: 8, background: '#fee' }}>
          <b>{this.props.name} crashed:</b>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{String(this.state.error.message)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Marks a section "ok" once it renders without throwing, and tracks mount/unmount
 * counts so StrictMode's deliberate double-invoke is visible in the results. */
export function MountTracker({ name }: { name: string }) {
  React.useEffect(() => {
    const r = libResults[name];
    if (r) {
      r.mounts++;
      if (r.status === 'pending') r.status = 'ok';
    }
    return () => {
      const r2 = libResults[name];
      if (r2) r2.unmounts++;
    };
  }, [name]);
  return null;
}
