import {
  type State,
  type Step,
  type Curve,
  type BezierControls,
  type PaletteConfig,
  type Origin,
  type AppSettings,
  DEFAULT_SETTINGS,
} from "./types";
import { deriveChromaCurve, snap } from "./derive";
import { BEZIER_PRESETS, bezierToCurve } from "./bezier";
import { nextPaletteId } from "./palette-utils";

export type Listener = (state: State) => void;

/** Starter palettes and the template for user-added palettes. */
const DEFAULT_PALETTES = [
  { id: "primary", origin: { l: 0.62, c: 0.18, h: 264 }, name: "Primary" },
  { id: "neutral", origin: { l: 0.82, c: 0.018, h: 264 }, name: "Neutral" },
  { id: "accent", origin: { l: 0.417, c: 0.136, h: 25 }, name: "Accent" },
] as const;

/** Build a PaletteConfig from an origin — keeps chroma curve and origin in sync. */
function makePalette(
  origin: Origin,
  name: string,
  lightness: Curve,
  steps: string[],
  smoothFactor: number,
): PaletteConfig {
  return { chroma: deriveChromaCurve(origin, lightness, steps, { smoothFactor }), origin, name };
}

export class Store {
  #state: State;
  #listeners = new Set<Listener>();
  #dirty = false;
  /** Baseline curve snapshot used to keep propagation idempotent within a frame. */
  #propagationBase: Curve | null = null;

  /**
   * @param state  Must satisfy the invariant that `lightness` is derived from
   *               `bezierControls` via `bezierToCurve`. Callers are responsible
   *               for this — the constructor trusts its input.
   */
  constructor(state: State) {
    this.#state = structuredClone(state);
    this.#buildStepIndex();
  }

  // --- readers ---

  getState(): State {
    return this.#state;
  }

  getSettings(): AppSettings {
    return this.#state.settings;
  }

  // --- writers ---

  /** Replace the bezier controls and re-derive the lightness curve and all chroma curves. */
  setBezierControls(controls: BezierControls): void {
    this.#state.bezierControls = { ...controls };
    this.#state.lightness = bezierToCurve(controls, this.#state.settings.steps);
    this.#recalculateAllChroma();
    this.#scheduleNotify();
  }

  /** Replace the step grid — regenerates lightness curve and all chroma curves. */
  setSteps(steps: string[]): void {
    this.#state.settings.steps = steps;
    this.#buildStepIndex();
    this.#state.lightness = bezierToCurve(this.#state.bezierControls, steps);
    this.#recalculateAllChroma();
    this.#scheduleNotify();
  }

  setChroma(paletteId: string, step: Step, value: number, propagate: boolean): void {
    const palette = this.#state.palettes[paletteId];
    if (!palette) return;

    const max = this.#state.settings.maxChroma;
    if (propagate) {
      this.#propagate(palette.chroma, step, value, max);
    } else {
      palette.chroma[step] = snap(Math.max(0, Math.min(max, value)));
    }
    this.#scheduleNotify();
  }

  setOrigin(paletteId: string, l: number, c: number, h: number): void {
    const palette = this.#state.palettes[paletteId];
    if (!palette) return;

    const origin = { l, c, h };
    palette.origin = origin;
    palette.chroma = deriveChromaCurve(origin, this.#state.lightness, this.#state.settings.steps, {
      smoothFactor: this.#state.settings.chromaSmoothFactor,
    });
    this.#scheduleNotify();
  }

  setPaletteName(paletteId: string, name: string): void {
    if (!this.#state.palettes[paletteId]) return;
    this.#state.palettes[paletteId].name = name.trim() || paletteId;
    this.#scheduleNotify();
  }

  /**
   * Add a palette with an explicit id and config. Used for cloning — the
   * caller is responsible for generating the id and building the config.
   */
  addPalette(id: string, config: PaletteConfig): void {
    this.#state.palettes[id] = config;
    // Direct notify (not scheduleNotify) so the DOM syncs immediately — this
    // is a discrete action, not a rapid-fire slider drag, and resetting
    // #propagationBase mid-frame is harmless here.
    this.#notify();
  }

  /** Create a new palette from the first default template and add it to state. */
  addDefaultPalette(): void {
    const tmpl = DEFAULT_PALETTES[0];
    const id = nextPaletteId(this.#state);
    this.#state.palettes[id] = makePalette(
      tmpl.origin,
      id,
      this.#state.lightness,
      this.#state.settings.steps,
      this.#state.settings.chromaSmoothFactor,
    );
    this.#notify();
  }

  removePalette(id: string): void {
    if (!this.#state.palettes[id]) return;
    delete this.#state.palettes[id];
    this.#notify();
  }

  setMaxChroma(value: number): void {
    this.#state.settings.maxChroma = value;
    this.#scheduleNotify();
  }

  setCeilingGamut(value: AppSettings["ceilingGamut"]): void {
    this.#state.settings.ceilingGamut = value;
    this.#scheduleNotify();
  }

  setPropagateDecay(value: number): void {
    this.#state.settings.propagateDecay = value;
    this.#scheduleNotify();
  }

  setChromaSmoothFactor(value: number): void {
    this.#state.settings.chromaSmoothFactor = value;
    this.#recalculateAllChroma();
    this.#scheduleNotify();
  }

  /**
   * Replace the entire state — used when hydrating from URL.
   *
   * Rebuilds `lightness` from `bezierControls` and recalculates all chroma
   * curves to enforce the invariant that these are always consistent. This
   * is a no-op for correctly-constructed state and a repair for anything
   * that isn't.
   */
  load(state: State): void {
    this.#state = structuredClone(state);
    this.#buildStepIndex();
    // Re-derive lightness so it can never drift from bezierControls, but
    // leave chroma alone — the URL is the source of truth for user edits.
    this.#state.lightness = bezierToCurve(this.#state.bezierControls, this.#state.settings.steps);
    this.#notify();
  }

  // --- subscriptions ---

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  /** Re-derive chroma for a single palette from its origin and current lightness. */
  recalculateChroma(paletteId: string): void {
    this.#deriveChromaFor(paletteId);
    this.#scheduleNotify();
  }

  // --- internal ---

  /** Index lookup for the current steps, rebuilt when steps change. */
  #stepIndex: Record<string, number> = {};

  /** Minimum sigma for the Gaussian — gives a small spread even at decay=0. */
  static #SIGMA_MIN = 0.3;
  /** Scales the quadratic decay→sigma mapping so the spread slider feels useful. */
  static #SIGMA_SCALE = 15;

  /**
   * Apply a delta to every step, weighted by distance from the changed step.
   *
   * Snaps a baseline copy of the curve on the first call in a frame and
   * computes all deltas from that snapshot. This keeps rapid slider drags
   * (many small deltas) from producing a different result than a single slow
   * drag, which would otherwise happen because intermediate snap() rounding
   * is non-linear.
   */
  #propagate(curve: Curve, step: Step, newValue: number, max: number): void {
    if (!this.#propagationBase) {
      this.#propagationBase = { ...curve };
    }
    const base = this.#propagationBase;

    const delta = newValue - base[step];
    const changedIndex = this.#stepIndex[step];
    const spread = this.#state.settings.propagateDecay;

    // Gaussian bell curve — creates a smooth bump centered on the dragged
    // slider instead of an exponential taper.  σ² maps the 0.1–0.9 spread
    // slider so d=1 barely moves at 0.1 and d=19 still shifts at 0.9.
    const sigma = Store.#SIGMA_MIN + spread * spread * Store.#SIGMA_SCALE;
    const twoSigmaSq = 2 * sigma * sigma;

    const steps = this.#state.settings.steps;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const distance = Math.abs(i - changedIndex);
      const weight = Math.exp(-(distance * distance) / twoSigmaSq);
      const val = base[s] + delta * weight;
      curve[s] = snap(Math.max(0, Math.min(max, val)));
    }
  }

  #deriveChromaFor(paletteId: string): void {
    const palette = this.#state.palettes[paletteId];
    if (!palette) return;
    palette.chroma = deriveChromaCurve(
      palette.origin,
      this.#state.lightness,
      this.#state.settings.steps,
      { smoothFactor: this.#state.settings.chromaSmoothFactor },
    );
  }

  #buildStepIndex(): void {
    const idx: Record<string, number> = {};
    const steps = this.#state.settings.steps;
    for (let i = 0; i < steps.length; i++) {
      idx[steps[i]] = i;
    }
    this.#stepIndex = idx;
  }

  #recalculateAllChroma(): void {
    for (const id of Object.keys(this.#state.palettes)) {
      this.#deriveChromaFor(id);
    }
  }

  #scheduleNotify(): void {
    if (!this.#dirty) {
      this.#dirty = true;
      requestAnimationFrame(() => {
        this.#dirty = false;
        this.#notify();
      });
    }
  }

  #notify(): void {
    this.#propagationBase = null;
    for (const fn of this.#listeners) {
      fn(this.#state);
    }
  }

  // --- serialization ---

  toJSON(): State {
    return this.#state;
  }

  static fromJSON(json: State): Store {
    return new Store(json);
  }

  // --- factory ---

  /** Create a store with the default palettes. */
  static default(): Store {
    const settings = { ...DEFAULT_SETTINGS };
    const bezierControls = { ...BEZIER_PRESETS[0].controls };
    const lightness = bezierToCurve(bezierControls, settings.steps);
    const palettes: Record<string, PaletteConfig> = {};
    for (const p of DEFAULT_PALETTES) {
      palettes[p.id] = makePalette(
        p.origin,
        p.name,
        lightness,
        settings.steps,
        settings.chromaSmoothFactor,
      );
    }
    return new Store({
      bezierControls,
      lightness,
      palettes,
      settings,
    });
  }
}

/** Singleton store instance. */
export const store = Store.default();
