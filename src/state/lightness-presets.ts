import { STEPS, type Curve } from "./types";
import { snap } from "./derive";

// ---------------------------------------------------------------------------
// Preset curves  (all go light → dark: step 0 is brightest, step 950 darkest)
// ---------------------------------------------------------------------------

/**
 * Logistic S-curve — slow at the extremes, steepest through the mid-tones.
 * High=0.995, low=0.17, midpoint around step 500.
 */
export const S_CURVE: Curve = makeCurve((i, n) => {
  const t = i / n;
  const k = 6; // steepness
  const s = 1 / (1 + Math.exp(-k * (t - 0.5)));
  return snap(0.995 - 0.825 * s);
});

/** Evenly spaced from light (0.995) to dark (0.05). */
export const LINEAR: Curve = makeCurve((i, n) => 0.995 - (i / n) * 0.945);

/** Stays bright through most steps, then drops sharply at the dark end. */
export const BRIGHT: Curve = makeCurve((i, n) => 0.995 - 0.945 * (i / n) ** 2);

/** Drops into the shadows quickly, stays dark for most steps. */
export const DARK: Curve = makeCurve((i, n) => 0.995 - 0.945 * Math.sqrt(i / n));

/** Every step the same mid-range lightness. */
export const FLAT: Curve = makeCurve(() => 0.55);

// ---------------------------------------------------------------------------
// Registry (drives the dropdown)
// ---------------------------------------------------------------------------

export const LIGHTNESS_PRESETS: { key: string; label: string; curve: Curve }[] = [
  { key: "s-curve", label: "S-curve", curve: S_CURVE },
  { key: "linear", label: "Linear", curve: LINEAR },
  { key: "bright", label: "Bright", curve: BRIGHT },
  { key: "dark", label: "Dark", curve: DARK },
  { key: "flat", label: "Flat", curve: FLAT },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Curve by calling `fn(index, lastIndex)` for each step. */
function makeCurve(fn: (i: number, n: number) => number): Curve {
  const curve = {} as Curve;
  const n = STEPS.length - 1;
  for (let i = 0; i < STEPS.length; i++) {
    curve[STEPS[i]] = snap(fn(i, n));
  }
  return curve;
}
