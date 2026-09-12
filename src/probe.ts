/**
 * Per-frame probe.
 *
 * Records, once per animation frame, the grid container's measured width/height
 * alongside every child's computed `transform` and box size. A "torn frame" is a
 * frame where the container width changed relative to the previous frame but the
 * children's transforms did not -- i.e. the browser painted a frame in which the
 * container had already resized while the children still carried stale positions.
 */

export type Frame = {
  t: number;
  w: number;
  h: number;
  transforms: string[];
  tx: number[];
  ty: number[];
  cw: number[];
  ch: number[];
};

export type ProbeResult = {
  cell: string;
  mode: string;
  frames: number;
  durationMs: number;
  tornFramesWidth: number;
  tornFramesHeight: number;
  overlapFrames: number;
  overflowFrames: number;
  widthChangeFrames: number;
  heightChangeFrames: number;
  tornDetail: Array<{ t: number; prevW: number; w: number; phase: string }>;
  overlapDetail: Array<{ t: number; a: number; b: number; px: number; phase: string }>;
  marks: Array<{ t: number; label: string }>;
  raw?: Frame[];
};

const MATRIX = /matrix\(([^)]+)\)/;

function translateOf(transform: string): [number, number] {
  const m = MATRIX.exec(transform);
  if (!m) return [0, 0];
  const p = m[1].split(',').map((s) => parseFloat(s));
  return [p[4] ?? 0, p[5] ?? 0];
}

class Probe {
  frames: Frame[] = [];
  marks: Array<{ t: number; label: string }> = [];
  running = false;
  stale = false;
  private rafId = 0;
  cell = '?';
  mode = '?';

  mark(label: string) {
    this.marks.push({ t: performance.now(), label });
  }

  start() {
    if (this.running) return;
    this.frames = [];
    this.marks = [];
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      const el = document.querySelector('.the-grid') as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        // Direct element children of the grid container are the positioned
        // GridItem wrappers that carry the transform.
        const kids = Array.from(el.children) as HTMLElement[];
        const transforms: string[] = [];
        const tx: number[] = [];
        const ty: number[] = [];
        const cw: number[] = [];
        const ch: number[] = [];
        for (const k of kids) {
          const tr = getComputedStyle(k).transform;
          transforms.push(tr);
          const [x, y] = translateOf(tr);
          tx.push(x);
          ty.push(y);
          cw.push(k.offsetWidth);
          ch.push(k.offsetHeight);
        }
        const prev = this.frames[this.frames.length - 1];
        this.frames.push({ t: performance.now(), w: r.width, h: r.height, transforms, tx, ty, cw, ch });
        // Emit user-timing marks so an independent DevTools trace can show
        // whether a Paint lands inside the stale window.
        if (prev) {
          const sameT =
            prev.transforms.length === transforms.length &&
            prev.transforms.every((t, j) => t === transforms[j]);
          if (prev.w !== r.width && sameT) {
            this.stale = true;
            performance.mark('TEAR');
          } else if (this.stale && !sameT) {
            this.stale = false;
            performance.mark('SETTLE');
          }
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private phaseAt(t: number): string {
    let phase = 'init';
    for (const m of this.marks) {
      if (m.t <= t) phase = m.label;
      else break;
    }
    return phase;
  }

  result(includeRaw = false): ProbeResult {
    const f = this.frames;
    let tornW = 0;
    let tornH = 0;
    let overlap = 0;
    let overflow = 0;
    let wChange = 0;
    let hChange = 0;
    const tornDetail: ProbeResult['tornDetail'] = [];
    const overlapDetail: ProbeResult['overlapDetail'] = [];

    for (let i = 1; i < f.length; i++) {
      const prev = f[i - 1];
      const cur = f[i];
      const sameTransforms =
        prev.transforms.length === cur.transforms.length &&
        prev.transforms.every((t, j) => t === cur.transforms[j]);

      if (cur.w !== prev.w) {
        wChange++;
        if (sameTransforms) {
          tornW++;
          if (tornDetail.length < 60)
            tornDetail.push({ t: cur.t, prevW: prev.w, w: cur.w, phase: this.phaseAt(cur.t) });
        }
      }
      if (cur.h !== prev.h) {
        hChange++;
        if (sameTransforms) tornH++;
      }

      // Geometric consistency of the frame as painted: do any two cards overlap?
      for (let a = 0; a < cur.tx.length; a++) {
        for (let b = a + 1; b < cur.tx.length; b++) {
          const ax1 = cur.tx[a];
          const ax2 = ax1 + cur.cw[a];
          const ay1 = cur.ty[a];
          const ay2 = ay1 + cur.ch[a];
          const bx1 = cur.tx[b];
          const bx2 = bx1 + cur.cw[b];
          const by1 = cur.ty[b];
          const by2 = by1 + cur.ch[b];
          const ox = Math.min(ax2, bx2) - Math.max(ax1, bx1);
          const oy = Math.min(ay2, by2) - Math.max(ay1, by1);
          if (ox > 1 && oy > 1) {
            overlap++;
            if (overlapDetail.length < 60)
              overlapDetail.push({ t: cur.t, a, b, px: Math.round(oy), phase: this.phaseAt(cur.t) });
            a = cur.tx.length;
            break;
          }
        }
      }

      // Does any card extend past the container's declared height?
      for (let a = 0; a < cur.ty.length; a++) {
        if (cur.ty[a] + cur.ch[a] > cur.h + 1) {
          overflow++;
          break;
        }
      }
    }

    return {
      cell: this.cell,
      mode: this.mode,
      frames: f.length,
      durationMs: f.length ? f[f.length - 1].t - f[0].t : 0,
      tornFramesWidth: tornW,
      tornFramesHeight: tornH,
      overlapFrames: overlap,
      overflowFrames: overflow,
      widthChangeFrames: wChange,
      heightChangeFrames: hChange,
      tornDetail,
      overlapDetail,
      marks: this.marks,
      raw: includeRaw ? f : undefined,
    };
  }
}

export const probe = new Probe();
