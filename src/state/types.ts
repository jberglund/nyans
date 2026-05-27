/** The 20 lightness/chroma stops that define a curve. */
export const STEPS = [
  "0",
  "50",
  "100",
  "150",
  "200",
  "250",
  "300",
  "350",
  "400",
  "450",
  "500",
  "550",
  "600",
  "650",
  "700",
  "750",
  "800",
  "850",
  "900",
  "950",
] as const;

export type Step = (typeof STEPS)[number];

/** A curve maps each step to a numeric value. */
export type Curve = Record<Step, number>;

/** LCH values for the original source color (used to hydrate the color input). */
export interface Origin {
  l: number;
  c: number;
  h: number;
}

/** Per-palette configuration — chroma curve + source color origin + display name. */
export interface PaletteConfig {
  chroma: Curve;
  origin: Origin;
  name: string;
}

/** Global app settings that affect all palettes. */
export interface AppSettings {
  /** Slider max for chroma step-sliders. */
  maxChroma: number;
  /** Gamut used for the ceiling / danger-zone on chroma sliders. */
  ceilingGamut: "srgb" | "p3" | "rec2020";
  /** When true, slider changes ripple outward to neighboring steps. */
  propagateChanges: boolean;
  /** Decay factor for change propagation (0–1). Higher = broader spread. */
  propagateDecay: number;
}

/** Default app settings — single source of truth for initial values. */
export const DEFAULT_SETTINGS: AppSettings = {
  maxChroma: 0.35,
  ceilingGamut: "p3",
  propagateChanges: false,
  propagateDecay: 0.5,
};

/** The full application state. */
export interface State {
  lightness: Curve;
  palettes: Record<string, PaletteConfig>;
  settings: AppSettings;
}
