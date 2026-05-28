import { describe, it, expect } from "vitest";
import { constrainControls } from "./bezier";
import type { BezierControls } from "./types";

// Helper to build controls, defaulting to reasonable values
function ctrl(overrides: Partial<BezierControls> = {}): BezierControls {
  return {
    p0y: 0,
    p1x: 0.25,
    p1y: 0.25,
    p2x: 0.75,
    p2y: 0.75,
    p3y: 1,
    ...overrides,
  };
}

describe("constrainControls", () => {
  // -----------------------------------------------------------------------
  // Normal case: p0 above p3  (p0y < p3y)
  //   p1 must stay ≥ p0y (can't go visually above p0)
  //   p2 must stay ≤ p3y (can't go visually below p3)
  // -----------------------------------------------------------------------

  describe("when p0 is above p3 (p0y < p3y)", () => {
    it("leaves valid p1y and p2y unchanged", () => {
      const c = ctrl({ p0y: 0.1, p1y: 0.3, p2y: 0.7, p3y: 0.9 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.3);
      expect(result.p2y).toBe(0.7);
    });

    it("clamps p1y up to p0y when p1 would be above p0", () => {
      const c = ctrl({ p0y: 0.4, p1y: 0.2, p2y: 0.6, p3y: 0.9 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.4); // clamped up to p0y
      expect(result.p2y).toBe(0.6); // unchanged
    });

    it("clamps p2y down to p3y when p2 would be below p3", () => {
      const c = ctrl({ p0y: 0.1, p1y: 0.3, p2y: 0.95, p3y: 0.8 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.3); // unchanged
      expect(result.p2y).toBe(0.8); // clamped down to p3y
    });

    it("clamps both when both violate", () => {
      const c = ctrl({ p0y: 0.5, p1y: 0.2, p2y: 0.9, p3y: 0.7 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.5); // clamped to p0y
      expect(result.p2y).toBe(0.7); // clamped to p3y
    });

    it("allows p1y exactly at p0y", () => {
      const c = ctrl({ p0y: 0.3, p1y: 0.3, p3y: 0.8 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.3);
    });

    it("allows p2y exactly at p3y", () => {
      const c = ctrl({ p0y: 0.1, p2y: 0.9, p3y: 0.9 });
      const result = constrainControls(c);
      expect(result.p2y).toBe(0.9);
    });
  });

  // -----------------------------------------------------------------------
  // Flipped case: p0 below p3  (p0y > p3y)
  //   p1 must stay ≤ p0y (can't go visually below p0)
  //   p2 must stay ≥ p3y (can't go visually above p3)
  // -----------------------------------------------------------------------

  describe("when p0 is below p3 (p0y > p3y)", () => {
    it("leaves valid p1y and p2y unchanged", () => {
      const c = ctrl({ p0y: 0.9, p1y: 0.7, p2y: 0.3, p3y: 0.1 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.7);
      expect(result.p2y).toBe(0.3);
    });

    it("clamps p1y down to p0y when p1 would be below p0", () => {
      const c = ctrl({ p0y: 0.6, p1y: 0.8, p2y: 0.3, p3y: 0.2 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.6); // clamped down to p0y
      expect(result.p2y).toBe(0.3); // unchanged
    });

    it("clamps p2y up to p3y when p2 would be above p3", () => {
      const c = ctrl({ p0y: 0.9, p1y: 0.7, p2y: 0.05, p3y: 0.2 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.7); // unchanged
      expect(result.p2y).toBe(0.2); // clamped up to p3y
    });

    it("clamps both when both violate", () => {
      const c = ctrl({ p0y: 0.7, p1y: 0.9, p2y: 0.1, p3y: 0.3 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.7); // clamped to p0y
      expect(result.p2y).toBe(0.3); // clamped to p3y
    });
  });

  // -----------------------------------------------------------------------
  // Equal anchors (p0y === p3y)
  // -----------------------------------------------------------------------

  describe("when anchors are equal (p0y === p3y)", () => {
    it("leaves everything unchanged", () => {
      const c = ctrl({ p0y: 0.5, p1y: 0.2, p2y: 0.8, p3y: 0.5 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.2);
      expect(result.p2y).toBe(0.8);
    });

    it("leaves handles at anchor value unchanged", () => {
      const c = ctrl({ p0y: 0.5, p1y: 0.5, p2y: 0.5, p3y: 0.5 });
      const result = constrainControls(c);
      expect(result.p1y).toBe(0.5);
      expect(result.p2y).toBe(0.5);
    });
  });

  // -----------------------------------------------------------------------
  // x-values are never touched
  // -----------------------------------------------------------------------

  it("never modifies p1x or p2x", () => {
    const c = ctrl({ p0y: 0, p1x: 0.42, p1y: 0, p2x: 0.78, p2y: 1, p3y: 1 });
    const result = constrainControls(c);
    expect(result.p1x).toBe(0.42);
    expect(result.p2x).toBe(0.78);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("handles boundary values (0 and 1)", () => {
    const c = ctrl({ p0y: 0, p1y: 0, p2y: 1, p3y: 1 });
    const result = constrainControls(c);
    expect(result.p1y).toBe(0);
    expect(result.p2y).toBe(1);
  });

  it("handles p1y at boundary in flipped case", () => {
    const c = ctrl({ p0y: 1, p1y: 1, p2y: 0, p3y: 0 });
    const result = constrainControls(c);
    expect(result.p1y).toBe(1);
    expect(result.p2y).toBe(0);
  });
});
