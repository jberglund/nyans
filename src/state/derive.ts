import Color from "colorjs.io";
import { type State, STEPS, type Step, type Curve } from "./types";

export interface Swatch {
  step: Step;
  /** CSS color string, e.g. "oklch(0.62 0.18 264)" */
  css: string;
  l: number;
  c: number;
  h: number;
}

export type GamutLabel = "srgb" | "p3" | "rec2020" | "rec2020+";

const GAMUTS = ["srgb", "p3", "rec2020"] as const;

/**
 * Derive all swatches for a palette from the current state.
 * Pure function — no side effects, no store dependency.
 */
export function deriveSwatches(state: State, paletteId: string): Swatch[] {
  const palette = state.palettes[paletteId];
  if (!palette) return [];

  return STEPS.map((step) => {
    const l = state.lightness[step];
    const c = palette.chroma[step];
    const h = palette.origin.h;

    return {
      step,
      l: snap(l),
      c: snap(c),
      h: snap(h),
      css: `oklch(${snap(l)} ${snap(c)} ${snap(h)})`,
    };
  });
}

// ---------------------------------------------------------------------------
// Chroma curve derivation
// ---------------------------------------------------------------------------

/** Gamut used as the ceiling when deriving chroma curves. */
const DERIVATION_GAMUT = "srgb";

/**
 * Derive a chroma curve that respects the gamut boundary for the origin's hue.
 *
 * Instead of scaling a fixed template uniformly (which ignores how different
 * hues have wildly different chroma ceilings across lightness), we compute a
 * "fill ratio" — how saturated the origin is relative to the maximum possible
 * at its (L,H) — and apply that same ratio against the gamut ceiling at every
 * step. This naturally produces:
 *
 * - Blues:  high chroma at low L, tapering hard at high L
 * - Reds:   peak at mid L, tapering at both ends
 * - Yellows: peak at high L, low at the dark end
 *
 * @param origin     The origin color (all three of `.l`, `.c`, `.h` are used)
 * @param lightness  Per-step lightness values (e.g. state.lightness)
 */
export function deriveChromaCurve(
  origin: { l: number; c: number; h: number },
  lightness: Curve,
): Curve {
  const maxOriginC = maxInGamutChroma(origin.l, origin.h, DERIVATION_GAMUT);
  const fillRatio = maxOriginC > 0 ? Math.min(origin.c / maxOriginC, 1.0) : 0;

  const result: Record<string, number> = {};
  for (const step of STEPS) {
    const l = lightness[step];
    const ceiling = maxInGamutChroma(l, origin.h, DERIVATION_GAMUT);
    result[step] = snap(ceiling * fillRatio);
  }
  return result as Curve;
}

/**
 * Reconstruct a hex string from the origin LCH for hydrating a color input.
 */
export function originToHex(origin: { l: number; c: number; h: number }): string {
  const color = new Color("oklch", [origin.l, origin.c, origin.h]);
  return color.to("srgb").toString({ format: "hex" });
}

/** Round to 3 decimal places. Single source of truth for all value rounding. */
export function snap(n: number): number {
  return Number(n.toFixed(3));
}

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

/**
 * Wrap a pure function with a Map-based cache, keyed by its stringified
 * arguments. Capped to prevent unbounded growth over long sessions.
 */
function memoize<A extends unknown[], R>(fn: (...args: A) => R, max = 600): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const key = args.join(",");
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    if (cache.size >= max) cache.clear();

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// ---------------------------------------------------------------------------
// Gamut helpers
// ---------------------------------------------------------------------------

/**
 * Classify which gamut a given OKLCH color falls into.
 * Returns the narrowest gamut that contains the color.
 * Pure function — no side effects.
 */
function _classifyGamut(l: number, c: number, h: number): GamutLabel {
  const color = new Color("oklch", [l, c, h]);
  for (const gamut of GAMUTS) {
    try {
      if (color.to(gamut).inGamut()) {
        return gamut;
      }
    } catch {
      // Conversion failed for this space — try the next
    }
  }
  return "rec2020+";
}

/**
 * Binary search for the maximum chroma at a given L,H that stays within
 * the specified gamut. Used to position the ceiling/danger-zone on sliders.
 *
 * Uses the same `inGamut()` check as `classifyGamut` so the ceiling line
 * and the gamut badge are always consistent.
 */
function _maxInGamutChroma(l: number, h: number, gamut: string): number {
  let lo = 0;
  let hi = 0.6; // practical upper bound for OKLCH chroma

  // If even hi is in gamut, the danger zone is beyond the slider — return hi
  try {
    if (new Color("oklch", [l, hi, h]).to(gamut).inGamut()) {
      return hi;
    }
  } catch {
    // fall through to binary search
  }

  // 16 iterations on [0, 0.6] → precision ~0.00001 (well below slider step 0.001)
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    try {
      if (new Color("oklch", [l, mid, h]).to(gamut).inGamut()) {
        lo = mid;
      } else {
        hi = mid;
      }
    } catch {
      hi = mid;
    }
  }

  return snap(lo);
}

// Memoized exports — all inputs are snapped to 3 decimal places, so during a
// slider drag on one step, 19 of 20 calls hit the cache.
export const classifyGamut = memoize(_classifyGamut);
export const maxInGamutChroma = memoize(_maxInGamutChroma);
