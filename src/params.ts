// URL-param parsing shared by both pages of this SPA (the stack-grid repro
// and the dependency-stack smoke test), plus main.tsx which uses CELL/LIBS to
// pick the React root API and which page to mount.
const params = new URLSearchParams(location.search);

export const CELL = params.get('cell') ?? '3';
export const LIBS = params.get('libs') === '1';
export const PATH_B = params.get('pathB') !== '0';
export const DURATION = Number(params.get('duration') ?? '0');
// Number of grid cards. A larger grid makes React's render work non-trivial,
// which is where a concurrent root could plausibly yield and extend any tear.
export const N_CARDS = Number(params.get('cards') ?? '6');

/** Builds an href to the current page with the given params changed, leaving
 * everything else (including whichever params the current page doesn't care
 * about) untouched. */
export function linkWith(overrides: Record<string, string>): string {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(overrides)) q.set(k, v);
  return `?${q.toString()}`;
}
