import { STEPS, type Curve } from "./types";
import { snap } from "./derive";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All four control points of a cubic-bezier curve.
 *
 * P0.x = 0 and P3.x = 1 are fixed (the x-axis represents the step range).
 * P0.y and P3.y control the start / end lightness (y=0 → bright top,
 * y=1 → dark bottom).  P1 and P2 are the inner shape handles.
 */
export interface BezierControls {
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  p3y: number;
}

// ---------------------------------------------------------------------------
// Bezier math  (P0.x=0, P3.x=1 fixed; P0.y, P3.y variable)
// ---------------------------------------------------------------------------

/** Evaluate the parametric curve at t ∈ [0,1]. */
export function cubicBezierPoint(t: number, c: BezierControls): { x: number; y: number } {
  const { p0y, p1x, p1y, p2x, p2y, p3y } = c;
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: 3 * uu * t * p1x + 3 * u * tt * p2x + tt * t,
    y: uu * u * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + tt * t * p3y,
  };
}

/**
 * Solve for y on the bezier at a given x ∈ [0,1].
 * Newton-Raphson with binary-search fallback.
 */
export function bezierYAtX(x: number, c: BezierControls): number {
  const { p0y, p1x, p1y, p2x, p2y, p3y } = c;
  if (x <= 0) return p0y;
  if (x >= 1) return p3y;

  let t = x;

  for (let i = 0; i < 8; i++) {
    const u = 1 - t;
    const dxdt = 3 * u * u * p1x + 6 * u * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
    if (Math.abs(dxdt) < 1e-9) break;
    const xt = 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t;
    t -= (xt - x) / dxdt;
    t = Math.max(0, Math.min(1, t));
  }

  const u0 = 1 - t;
  const xt = 3 * u0 * u0 * t * p1x + 3 * u0 * t * t * p2x + t * t * t;
  if (Math.abs(xt - x) > 0.001) {
    t = bezierTAtXBinary(x, p1x, p2x);
  }

  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return uu * u * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + tt * t * p3y;
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
 * Generate a lightness Curve from bezier controls.
 *
 * The plot y-axis maps directly to lightness: y=0 is bright (L=1),
 * y=1 is dark (L=0).  So lightness = 1 − bezierYAtX(x).
 */
export function bezierToCurve(c: BezierControls): Curve {
  const curve = {} as Curve;
  const n = STEPS.length - 1;
  for (let i = 0; i < STEPS.length; i++) {
    const y = bezierYAtX(i / n, c);
    curve[STEPS[i]] = snap(1 - y);
  }
  return curve;
}

// ---------------------------------------------------------------------------
// Presets  (full-bezier shapes with p0y=0, p3y=1)
// ---------------------------------------------------------------------------

export const BEZIER_PRESETS: { key: string; label: string; controls: BezierControls }[] = [
  {
    key: "s-curve",
    label: "S-curve",
    controls: { p0y: 0.015, p1x: 0.75, p1y: 0.055, p2x: 0.25, p2y: 0.76, p3y: 0.8 },
  },
  {
    key: "linear",
    label: "Linear",
    controls: { p0y: 0, p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75, p3y: 1 },
  },
  {
    key: "bright",
    label: "Bright",
    controls: { p0y: 0, p1x: 0.5, p1y: 0.0, p2x: 0.8, p2y: 0.7, p3y: 1 },
  },
  {
    key: "dark",
    label: "Dark",
    controls: { p0y: 0, p1x: 0.2, p1y: 0.8, p2x: 0.5, p2y: 1.0, p3y: 1 },
  },
  {
    key: "flat",
    label: "Flat",
    controls: { p0y: 0, p1x: 0.3, p1y: 0.471, p2x: 0.7, p2y: 0.471, p3y: 1 },
  },
];
