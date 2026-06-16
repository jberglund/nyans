import { describe, it, expect } from "vitest";
import { snap, deriveChromaCurve } from "./derive";
import type { Curve } from "./types";

// A flat lightness curve at 0.5 — well within sRGB gamut for most hues.
const steps = ["0", "200", "400", "600", "800", "1000"];
const lightness: Curve = { "0": 0.5, "200": 0.5, "400": 0.5, "600": 0.5, "800": 0.5, "1000": 0.5 };

describe("deriveChromaCurve", () => {
  it("produces a non-zero curve when origin chroma is 0 (floor prevents flatlining)", () => {
    const curve = deriveChromaCurve({ l: 0.5, c: 0, h: 264 }, lightness, steps);
    const values = Object.values(curve);
    // Every step must have >0 chroma — the floor (MIN_FILL_RATIO * ceiling) kicks in.
    for (const v of values) {
      expect(v).toBeGreaterThan(0);
    }
    // All steps should have the same value (same L, same H → same ceiling → same floor).
    expect(new Set(values).size).toBe(1);
  });

  it("scales normally when origin chroma produces fillRatio > floor", () => {
    // Pick an origin chroma that's well above the floor — at L=0.5, H=264,
    // the sRGB gamut ceiling comfortably exceeds 0.1, so c=0.1 gives
    // fillRatio >> 0.05.
    const full = deriveChromaCurve({ l: 0.5, c: 0.1, h: 264 }, lightness, steps);
    // A half-saturated origin should produce roughly half the ceiling.
    const half = deriveChromaCurve({ l: 0.5, c: 0.05, h: 264 }, lightness, steps);

    for (const step of steps) {
      // Scaling: halving origin.c should ~halve chroma (within snap rounding).
      expect(full[step]).toBeGreaterThan(half[step]);
    }
  });
});

describe("snap", () => {
  it("rounds to 3 decimal places", () => {
    expect(snap(0.1234)).toBe(0.123);
    expect(snap(3.14159)).toBe(3.142);
    expect(snap(2.7182)).toBe(2.718);
  });

  it("rounds up at the 4th decimal", () => {
    expect(snap(0.0005)).toBe(0.001);
    expect(snap(0.9999)).toBe(1);
    expect(snap(2.3456)).toBe(2.346);
  });

  it("leaves whole numbers as-is", () => {
    expect(snap(1)).toBe(1);
    expect(snap(0)).toBe(0);
    expect(snap(42)).toBe(42);
  });

  it("handles negative numbers", () => {
    expect(snap(-0.1234)).toBe(-0.123);
    expect(snap(-0.9999)).toBe(-1);
  });
});
