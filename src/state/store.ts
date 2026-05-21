import {
  STEPS,
  type State,
  type Step,
  type Curve,
  type PaletteConfig,
  type Origin,
  type AppSettings,
} from "./types";
import { deriveChromaCurve, snap } from "./derive";
import { BEZIER_PRESETS, bezierToCurve, DEFAULT_START_L, DEFAULT_END_L } from "./bezier";

export type Listener = (state: State) => void;

export class Store {
  #state: State;
  #listeners = new Set<Listener>();
  #dirty = false;

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
    this.#state.lightness = { ...curve };
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

  addPalette(id: string, config: PaletteConfig): void {
    this.#state.palettes[id] = config;
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

  /** Apply a delta to every step, weighted by distance from the changed step. */
  #propagate(curve: Curve, step: Step, newValue: number, max: number): void {
    const delta = newValue - curve[step];
    const changedIndex = STEPS.indexOf(step);
    const decay = this.#state.settings.propagateDecay;

    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      const distance = Math.abs(i - changedIndex);
      const weight = Math.pow(decay, distance);
      const val = curve[s] + delta * weight;
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

  /** Create a store with sensible defaults and one palette. */
  static default(): Store {
    const origin = { l: 0.62, c: 0.18, h: 264 };
    const lightness = bezierToCurve(BEZIER_PRESETS[0].controls, DEFAULT_START_L, DEFAULT_END_L);
    return new Store({
      lightness,
      palettes: {
        p1: {
          chroma: deriveChromaCurve(origin, lightness),
          origin,
        },
      },
      settings: {
        maxChroma: 0.35,
        ceilingGamut: "p3",
        propagateChanges: false,
        propagateDecay: 0.5,
      },
    });
  }
}

/** Singleton store instance. */
export const store = Store.default();
