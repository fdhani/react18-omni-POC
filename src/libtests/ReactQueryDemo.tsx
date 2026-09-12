import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { MountTracker, libResults } from './ErrorBoundary';

/**
 * React Query v4.36.1 -- the doc's actual pinned version -- was previously
 * only checked at the peer-dependency level (its peer range already permits
 * React 18). This is the runtime test: does it actually work, and does it
 * exhibit the same class of risk already tested for react-redux (tearing
 * between two components reading the same cached value)?
 *
 * Notably, @tanstack/react-query@4.36.1 depends directly on
 * `use-sync-external-store` -- unlike react-redux@7 (which predates it and
 * uses its own subscription mechanism), React Query v4 already uses React's
 * own official concurrent-safe subscription primitive. If that holds up
 * here, it's a stronger starting position than react-redux's, not just an
 * equivalent one.
 */

let fetchCount = 0;
const QUERY_KEY = ['demo-counter'];

async function fetchCounter(): Promise<number> {
  fetchCount++;
  await new Promise((resolve) => setTimeout(resolve, 300));
  return fetchCount;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

function Reader({ id }: { id: string }) {
  // v4's status union is 'loading' | 'error' | 'success' -- 'pending' is v5's
  // renamed term, not this version's.
  const { data, status } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchCounter });
  return (
    <span data-rq-reader={id}>
      {status === 'loading' ? 'loading' : String(data)}
    </span>
  );
}

function MutationTrigger() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: number) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return next;
    },
    onSuccess: (next) => {
      // The optimistic/immediate-cache-update pattern the dependency-upgrade
      // investigation names in section 8.8 as the React Query replacement
      // for a Redux domain's reducer-driven update.
      client.setQueryData(QUERY_KEY, next);
    },
  });
  return (
    <button data-check="rq-mutate" onClick={() => mutation.mutate(9999)} disabled={mutation.isLoading}>
      Trigger mutation (setQueryData)
    </button>
  );
}

function TearProbe() {
  React.useEffect(() => {
    let raf = 0;
    let frames = 0;
    let tornFrames = 0;
    const tick = () => {
      const a = document.querySelector('[data-rq-reader="a"]')?.textContent ?? null;
      const b = document.querySelector('[data-rq-reader="b"]')?.textContent ?? null;
      if (a !== null && b !== null) {
        frames++;
        if (a !== b) tornFrames++;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => {
      cancelAnimationFrame(raf);
      const r = libResults['react-query'];
      if (r) {
        r.notes.push(`frames observed: ${frames}`);
        r.notes.push(`torn frames (readers disagreed): ${tornFrames}`);
        r.notes.push(`fetchCounter invocations (StrictMode would double this if not deduped): ${fetchCount}`);
        r.notes.push(`final cached value: ${queryClient.getQueryData(QUERY_KEY)}`);
      }
    }, 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stop);
    };
  }, []);
  return null;
}

export default function ReactQueryDemo() {
  return (
    <QueryClientProvider client={queryClient}>
      <div data-demo="react-query">
        <MountTracker name="react-query" />
        <TearProbe />
        reader A: <Reader id="a" /> &nbsp; reader B: <Reader id="b" />
        <div style={{ marginTop: 8 }}>
          <MutationTrigger />
        </div>
      </div>
    </QueryClientProvider>
  );
}
