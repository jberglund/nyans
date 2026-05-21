import { STEPS, type Curve } from "./types";
import { snap } from "./derive";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Two control points that define a cubic-bezier shape.
 * P0 = (0,0) and P3 = (1,1) are fixed.  Only P1 and P2 are adjustable.
 *
 * This is the same model as CSS `cubic-bezier()`.
 */
export interface BezierControls {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

// ---------------------------------------------------------------------------
// Bezier math  (P0=(0,0), P3=(1,1) fixed)
// ---------------------------------------------------------------------------

/** Evaluate the parametric curve at t ∈ [0,1]. */
export function cubicBezierPoint(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): { x: number; y: number } {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: 3 * uu * t * p1x + 3 * u * tt * p2x + tt * t,
    y: 3 * uu * t * p1y + 3 * u * tt * p2y + tt * t,
  };
}

/**
 * Solve for y on the bezier at a given x ∈ [0,1].
 * Newton-Raphson with binary-search fallback.
 */
export function bezierYAtX(x: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  let t = x;

  for (let i = 0; i < 8; i++) {
    const u = 1 - t;
    const dxdt = 3 * u * u * p1x + 6 * u * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
    if (Math.abs(dxdt) < 1e-9) break;
    const xt = 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t;
    t -= (xt - x) / dxdt;
    t = Math.max(0, Math.min(1, t));
  }

  const u = 1 - t;
  const xt = 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t;
  if (Math.abs(xt - x) > 0.001) {
    t = bezierTAtXBinary(x, p1x, p2x);
  }

  const uu = u * u;
  return 3 * uu * t * p1y + 3 * u * t * t * p2y + t * t * t;
}

function bezierTAtXBinary(x: number, p1x: number, p2x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const u = 1 - mid;
    const xt = 3 * u * u * mid * p1x + 3 * u * mid * mid * p2x + mid * mid * mid;
    if (xt < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Curve generation
// ---------------------------------------------------------------------------

/**
 * Generate a lightness Curve from bezier shape + endpoint lightness values.
 *
 * The bezier (y ∈ [0,1]) is scaled so that y=0 → startL and y=1 → endL.
 *
 * @param c      Bezier shape (P1, P2 in normalised space)
 * @param startL Lightness at step 0   (bright end, default 0.995)
 * @param endL   Lightness at step 950 (dark end,  default 0.05)
 */
export function bezierToCurve(c: BezierControls, startL: number, endL: number): Curve {
  const curve = {} as Curve;
  const n = STEPS.length - 1;
  const range = startL - endL;
  for (let i = 0; i < STEPS.length; i++) {
    const y = bezierYAtX(i / n, c.p1x, c.p1y, c.p2x, c.p2y);
    curve[STEPS[i]] = snap(startL - y * range);
  }
  return curve;
}

// ---------------------------------------------------------------------------
// Presets  (shape only — endpoints are separate)
// ---------------------------------------------------------------------------

export const BEZIER_PRESETS: { key: string; label: string; controls: BezierControls }[] = [
  {
    key: "s-curve",
    label: "S-curve",
    controls: { p1x: 0.75, p1y: 0.05, p2x: 0.25, p2y: 0.95 },
  },
  {
    key: "linear",
    label: "Linear",
    controls: { p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75 },
  },
  {
    key: "bright",
    label: "Bright",
    controls: { p1x: 0.5, p1y: 0.0, p2x: 0.8, p2y: 0.7 },
  },
  {
    key: "dark",
    label: "Dark",
    controls: { p1x: 0.2, p1y: 0.8, p2x: 0.5, p2y: 1.0 },
  },
  {
    key: "flat",
    label: "Flat",
    controls: { p1x: 0.3, p1y: 0.471, p2x: 0.7, p2y: 0.471 },
  },
];

/** Default endpoint lightness values. */
export const DEFAULT_START_L = 0.995;
export const DEFAULT_END_L = 0.05;
