import {
  STEPS,
  type State,
  type Step,
  type Curve,
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
function makePalette(origin: Origin, name: string, lightness: Curve): PaletteConfig {
  return { chroma: deriveChromaCurve(origin, lightness), origin, name };
}

export class Store {
  #state: State;
  #listeners = new Set<Listener>();
  #dirty = false;
  /** Baseline curve snapshot used to keep propagation idempotent within a frame. */
  #propagationBase: Curve | null = null;

  constructor(state: State) {
    this.#state = structuredClone(state);
  }

  // --- readers ---

  getLightness(step: Step): number {
    return this.#state.lightness[step];
  }

  getChroma(paletteId: string, step: Step): number {
    return this.#state.palettes[paletteId].chroma[step];
  }

  getOrigin(paletteId: string): Origin {
    return this.#state.palettes[paletteId].origin;
  }

  getState(): State {
    return this.#state;
  }

  getSettings(): AppSettings {
    return this.#state.settings;
  }

  // --- writers ---

  setLightness(step: Step, value: number): void {
    if (this.#state.settings.propagateChanges) {
      this.#propagate(this.#state.lightness, step, value, 1);
    } else {
      this.#state.lightness[step] = snap(value);
    }
    this.#scheduleNotify();
  }

  /** Replace the entire lightness curve (reset / preset). */
  setLightnessCurve(curve: Curve): void {
    const snapped = {} as Curve;
    for (const step of STEPS) {
      snapped[step] = snap(curve[step]);
    }
    this.#state.lightness = snapped;
    this.#notify();
  }

  setChroma(paletteId: string, step: Step, value: number): void {
    if (this.#state.settings.propagateChanges) {
      this.#propagate(
        this.#state.palettes[paletteId].chroma,
        step,
        value,
        this.#state.settings.maxChroma,
      );
    } else {
      this.#state.palettes[paletteId].chroma[step] = snap(value);
    }
    this.#scheduleNotify();
  }

  setOrigin(paletteId: string, l: number, c: number, h: number): void {
    const origin = { l, c, h };
    this.#state.palettes[paletteId].origin = origin;
    this.#state.palettes[paletteId].chroma = deriveChromaCurve(origin, this.#state.lightness);
    this.#scheduleNotify();
  }

  setPaletteName(paletteId: string, name: string): void {
    if (!this.#state.palettes[paletteId]) return;
    this.#state.palettes[paletteId].name = name.trim() || paletteId;
    this.#scheduleNotify();
  }

  addPalette(id: string, config: PaletteConfig): void {
    this.#state.palettes[id] = config;
    this.#notify();
  }

  /** Create a new palette from the first default template and add it to state. */
  addDefaultPalette(): void {
    const tmpl = DEFAULT_PALETTES[0];
    const id = nextPaletteId(this.#state);
    this.#state.palettes[id] = makePalette(tmpl.origin, id, this.#state.lightness);
    this.#notify();
  }

  removePalette(id: string): void {
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

  setPropagateChanges(value: boolean): void {
    this.#state.settings.propagateChanges = value;
    this.#scheduleNotify();
  }

  setPropagateDecay(value: number): void {
    this.#state.settings.propagateDecay = value;
    this.#scheduleNotify();
  }

  /** Replace the entire state — used when hydrating from URL. */
  load(state: State): void {
    this.#state = structuredClone(state);
    this.#notify();
  }

  // --- subscriptions ---

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  // --- internal ---

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
    const changedIndex = STEPS.indexOf(step);
    const decay = this.#state.settings.propagateDecay;

    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      const distance = Math.abs(i - changedIndex);
      const weight = Math.pow(decay, Math.sqrt(distance));
      const val = base[s] + delta * weight;
      curve[s] = snap(Math.max(0, Math.min(max, val)));
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
    const lightness = bezierToCurve(BEZIER_PRESETS[0].controls);
    const palettes: Record<string, PaletteConfig> = {};
    for (const p of DEFAULT_PALETTES) {
      palettes[p.id] = makePalette(p.origin, p.name, lightness);
    }
    return new Store({ lightness, palettes, settings: { ...DEFAULT_SETTINGS } });
  }
}

/** Singleton store instance. */
export const store = Store.default();
