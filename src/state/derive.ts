import Color from "colorjs.io";
import { type State, type Step, type Curve } from "./types";

export type GamutClass = "srgb" | "p3" | "rec2020" | "rec2020+";

export interface Swatch {
  step: Step;
  /** CSS color string, e.g. "oklch(0.62 0.18 264)" */
  css: string;
  l: number;
  c: number;
  h: number;
  /** Narrowest gamut this swatch fits in. "rec2020+" means it exceeds Rec.2020. */
  gamut: GamutClass;
}

/**
 * Derive all swatches for a palette from the current state.
 *
 * All values are already snapped by the store — the invariant is enforced
 * at every write path (setChroma, setOrigin, bezierToCurve, etc.).
 */
export function deriveSwatches(state: State, paletteId: string): Swatch[] {
  const palette = state.palettes[paletteId];
  if (!palette) return [];

  const steps = state.settings.steps;
  return steps.map((step) => {
    const l = state.lightness[step];
    const c = palette.chroma[step];
    const h = palette.origin.h;

    const gamut = classifyGamut(l, c, h);
    return { step, l, c, h, css: `oklch(${l} ${c} ${h})`, gamut };
  });
}

// ---------------------------------------------------------------------------
// Chroma curve derivation
// ---------------------------------------------------------------------------

/** Gamut used as the ceiling when deriving chroma curves. */
const DERIVATION_GAMUT = "srgb";

/** Options for {@link deriveChromaCurve}. */
export interface ChromaCurveOptions {
  /** 0–1. 0 = hug the gamut ceiling exactly. 1 = maximally smooth. */
  smoothFactor?: number;
}

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
 * Set `opts.smoothFactor` > 0 to apply a Gaussian blur across the ceiling
 * before multiplying by the fill ratio. This irons out local jaggies in the
 * gamut boundary while preserving each hue's characteristic overall shape.
 *
 * @param origin     The origin color (all three of `.l`, `.c`, `.h` are used)
 * @param lightness  Per-step lightness values (e.g. state.lightness)
 * @param opts       Optional smoothing configuration
 */
/** Minimum fill ratio so the chroma curve never fully flatlines. */
const MIN_FILL_RATIO = 0.05;

export function deriveChromaCurve(
  origin: { l: number; c: number; h: number },
  lightness: Curve,
  steps: string[],
  opts?: ChromaCurveOptions,
): Curve {
  const maxOriginC = maxInGamutChroma(origin.l, origin.h, DERIVATION_GAMUT);
  const rawRatio = maxOriginC > 0 ? clamp01(origin.c / maxOriginC) : 0;
  const fillRatio = Math.max(rawRatio, MIN_FILL_RATIO);

  // Build the raw ceiling array
  const ceilings = steps.map((step) =>
    maxInGamutChroma(lightness[step], origin.h, DERIVATION_GAMUT),
  );

  // Optionally smooth
  const smoothFactor = opts?.smoothFactor ?? 0;
  const smoothed = smoothFactor > 0 ? smoothCeilings(ceilings, smoothFactor) : ceilings;

  const result = {} as Curve;
  for (let i = 0; i < steps.length; i++) {
    result[steps[i]] = snap(smoothed[i] * fillRatio);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ceiling smoothing
// ---------------------------------------------------------------------------

/** Maps smoothFactor (0–1) → sigma for the Gaussian kernel. */
const SMOOTH_SIGMA_MIN = 0;
const SMOOTH_SIGMA_SCALE = 8;

/**
 * Apply a Gaussian blur to an array of ceiling values.
 *
 * Isolated so it can be swapped for a different smoothing strategy
 * (e.g. a polynomial fit) without touching any other code.
 *
 * @param values  Raw ceiling chroma values, one per step
 * @param factor  0–1. 0 returns `values` unchanged; 1 is maximally smooth.
 * @returns A new array of smoothed values (never mutates the input).
 */
export function smoothCeilings(values: number[], factor: number): number[] {
  if (factor <= 0 || values.length < 2) return [...values];

  // Quadratic mapping so the slider feels useful across the full range.
  // factor 0.5 → sigma 2 (light blur), factor 1 → sigma 8 (heavy blur).
  const sigma = SMOOTH_SIGMA_MIN + factor * factor * SMOOTH_SIGMA_SCALE;
  const twoSigmaSq = 2 * sigma * sigma;

  const n = values.length;
  const result = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    let weightSum = 0;
    for (let j = 0; j < n; j++) {
      const dist = i - j;
      const weight = Math.exp(-(dist * dist) / twoSigmaSq);
      sum += values[j] * weight;
      weightSum += weight;
    }
    // Renormalize so the kernel always sums to 1 (important near edges)
    result[i] = snap(sum / weightSum);
  }

  return result;
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

/** Clamp a value to [0, 1]. */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

/**
 * Wrap a pure function with a Map-based cache, keyed by its stringified
 * arguments. Only safe for functions whose args are primitives (numbers,
 * strings) — object args would collide on "[object Object]".
 *
 * Capped via simple FIFO eviction to prevent unbounded growth.
 */
function memoize<A extends unknown[], R>(fn: (...args: A) => R, max = 600): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const key = args.join(",");
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    if (cache.size >= max) {
      // Evict the oldest entry (Map iterates in insertion order)
      cache.delete(cache.keys().next().value!);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// ---------------------------------------------------------------------------
// Gamut helpers
// ---------------------------------------------------------------------------

/**
 * Classify which gamut a color falls in, from narrowest to widest.
 * Returns "rec2020+" if it exceeds even Rec.2020.
 */
function _classifyGamut(l: number, c: number, h: number): GamutClass {
  if (isInGamut(l, c, h, "srgb")) return "srgb";
  if (isInGamut(l, c, h, "p3")) return "p3";
  if (isInGamut(l, c, h, "rec2020")) return "rec2020";
  return "rec2020+";
}

const classifyGamut = memoize(_classifyGamut);

/**
 * Check whether a given LCH color is in gamut, silently treating exceptions
 * (e.g. from pathological inputs) as "out of gamut".
 */
function isInGamut(l: number, c: number, h: number, gamut: string): boolean {
  try {
    return new Color("oklch", [l, c, h]).to(gamut).inGamut();
  } catch {
    return false;
  }
}

/**
 * Binary search for the maximum chroma at a given L,H that stays within
 * the specified gamut. Used to position the ceiling/danger-zone on sliders.
 */
function _maxInGamutChroma(l: number, h: number, gamut: string): number {
  let lo = 0;
  let hi = 0.6; // practical upper bound for OKLCH chroma

  // If even hi is in gamut, the danger zone is beyond the slider — return hi
  if (isInGamut(l, hi, h, gamut)) return hi;

  // 16 iterations on [0, 0.6] → precision ~0.00001 (well below slider step 0.001)
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(l, mid, h, gamut)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return snap(lo);
}

// Memoized export — all inputs are snapped to 3 decimal places, so during a
// slider drag on one step, 19 of 20 calls hit the cache.
export const maxInGamutChroma = memoize(_maxInGamutChroma);
