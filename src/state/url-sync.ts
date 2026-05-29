import {
  type State,
  type AppSettings,
  DEFAULT_STEPS,
  type Curve,
  type BezierControls,
  type PaletteConfig,
  DEFAULT_SETTINGS,
} from "./types";
import { store, type Store } from "./store";
import { snap } from "./derive";
import { bezierToCurve } from "./bezier";

// ---------------------------------------------------------------------------
// URL format
// ---------------------------------------------------------------------------
// All numeric values are encoded as integers (×1000) to keep URLs compact.
//
// Example (abbreviated — real curves have 20 chroma values per palette):
//   #b=15,750,55,250,760,800&p=primary:620,180,264:40,60,80,...:Primary;neutral:820,18,264:40,60,...:Neutral
//
// Keys:
//   steps=<s0>,<s1>,...<sn>                   Step names (only if non-default)
//   b=<p0y>,<p1x>,<p1y>,<p2x>,<p2y>,<p3y>   Bezier controls (×1000)
//   p=<entries>                               Palettes, semicolon-delimited
//   max-chroma=<int>                          Max chroma slider value (×1000, only if non-default)
//   ceiling=<gamut>                           Ceiling gamut (only if non-default)
//
// Each palette entry:  id:origin:chroma:name
//   origin  = <l>,<c>,<h>                     (×1000)
//   chroma  = <v0>,<v1>,...<v19>              (×1000)
//   name    = URI-encoded display name

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse the URL hash fragment into application state.
 * Returns null if the URL is empty or irrecoverably malformed.
 */
function parseHashParams(): State | null {
  const raw = location.hash.slice(1);
  if (!raw) return null;

  const params = new URLSearchParams(raw);

  // --- steps ---
  const steps = parseSteps(params);

  // --- lightness / bezier ---
  const lightnessData = parseLightnessData(params, steps);
  if (!lightnessData) return null;

  // --- palettes ---
  const palettes = parsePalettes(params, steps);
  if (Object.keys(palettes).length === 0) return null;

  // --- settings ---
  const settings = parseSettings(params, steps);

  return { ...lightnessData, palettes, settings };
}

function parseLightnessData(
  params: URLSearchParams,
  steps: string[],
): {
  bezierControls: BezierControls;
  lightness: Curve;
} | null {
  const bezierRaw = params.get("b");
  if (!bezierRaw) return null;

  const bezierControls = parseBezierControls(bezierRaw);
  if (!bezierControls) return null;

  return { bezierControls, lightness: bezierToCurve(bezierControls, steps) };
}

function parsePalettes(params: URLSearchParams, steps: string[]): Record<string, PaletteConfig> {
  const raw = params.get("p");
  if (!raw) return {};

  const palettes: Record<string, PaletteConfig> = {};

  for (const entry of raw.split(";")) {
    const [id, originRaw, chromaRaw, ...rest] = entry.split(":");
    if (!id || !originRaw || !chromaRaw) continue;

    const origin = parseOrigin(originRaw);
    const chroma = parseCurve(chromaRaw, steps);
    if (!origin || !chroma) continue;

    // name is the remainder joined back — URI-encoded so it won't
    // contain literal ":" in practice, but this is defensive.
    const name = rest.length > 0 ? decodeURIComponent(rest.join(":")) : id;

    palettes[id] = { chroma, origin, name };
  }

  return palettes;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Serialize current state into a URL hash fragment.
 * Uses replaceState to avoid flooding browser history on every slider drag.
 */
function syncToUrl(state: State): void {
  const c = state.bezierControls;
  const parts = [
    `b=${enc(c.p0y)},${enc(c.p1x)},${enc(c.p1y)},${enc(c.p2x)},${enc(c.p2y)},${enc(c.p3y)}`,
  ];

  const steps = state.settings.steps;

  // Steps — only write if non-default
  if (!stepsEqual(steps, DEFAULT_STEPS)) {
    parts.push(`steps=${steps.join(",")}`);
  }

  const paletteEntries = Object.entries(state.palettes).map(([id, palette]) => {
    // l and c are fractional (0–1 range), need ×1000 for precision.
    // h is degrees (0–360), already an integer — no scaling needed.
    const origin = `${enc(palette.origin.l)},${enc(palette.origin.c)},${Math.round(palette.origin.h)}`;
    const chroma = curveToString(palette.chroma, steps);
    const name = encodeURIComponent(palette.name);
    return `${id}:${origin}:${chroma}:${name}`;
  });
  parts.push(`p=${paletteEntries.join(";")}`);

  // Settings — only write non-default values to keep URLs clean
  if (state.settings.maxChroma !== DEFAULT_SETTINGS.maxChroma) {
    parts.push(`max-chroma=${enc(state.settings.maxChroma)}`);
  }
  if (state.settings.ceilingGamut !== DEFAULT_SETTINGS.ceilingGamut) {
    parts.push(`ceiling=${state.settings.ceilingGamut}`);
  }

  history.replaceState(null, "", `#${parts.join("&")}`);
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------

/**
 * Wire up the store so every change automatically syncs to the URL.
 * Returns an unsubscribe function.
 *
 * Syncs are debounced at 400 ms to avoid hammering history.replaceState
 * on every slider drag — which causes significant jank in Chrome.
 */
export function initUrlSync(s: Store = store): () => void {
  // Hydrate from URL on first load — URL wins over defaults
  const parsed = parseHashParams();
  if (parsed) {
    s.load(parsed);
  } else {
    // Push initial state so the user gets a shareable URL immediately
    syncToUrl(s.getState());
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = s.subscribe((state) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      syncToUrl(state);
    }, 400);
  });

  // Flush any pending sync on unsubscribe or page unload so the last edit
  // isn't lost when the user navigates away within the debounce window.
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      syncToUrl(s.getState());
    }
  };

  window.addEventListener("beforeunload", flush);

  return () => {
    flush();
    window.removeEventListener("beforeunload", flush);
    unsubscribe();
  };
}

// ---------------------------------------------------------------------------
// Helpers — encode / decode
// ---------------------------------------------------------------------------

/** Encode a value to its integer representation (×1000). */
function enc(n: number): number {
  return Math.round(n * 1000);
}

/** Decode an integer back, rounded to match snap precision. */
function dec(n: number): number {
  return snap(n / 1000);
}

// ---------------------------------------------------------------------------
// Helpers — parse individual fields
// ---------------------------------------------------------------------------

function parseBezierControls(raw: string): BezierControls | null {
  const parts = raw.split(",").map(Number);
  if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) return null;
  const [p0y, p1x, p1y, p2x, p2y, p3y] = parts as number[];
  return {
    p0y: dec(p0y),
    p1x: dec(p1x),
    p1y: dec(p1y),
    p2x: dec(p2x),
    p2y: dec(p2y),
    p3y: dec(p3y),
  };
}

function parseCurve(raw: string, steps: string[]): Curve | null {
  const parts = raw.split(",").map(Number);
  if (parts.length !== steps.length || parts.some((n) => !Number.isFinite(n))) return null;
  const curve = {} as Curve;
  for (let i = 0; i < steps.length; i++) {
    curve[steps[i]] = dec(parts[i]);
  }
  return curve;
}

function parseOrigin(raw: string): { l: number; c: number; h: number } | null {
  const parts = raw.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  // l and c are ×1000 encoded; h is degrees, stored as-is.
  const [l, c, h] = parts as number[];
  return { l: dec(l), c: dec(c), h: Math.round(h) };
}

function parseSettings(params: URLSearchParams, steps: string[]): AppSettings {
  const maxChromaRaw = params.get("max-chroma");
  const ceilingRaw = params.get("ceiling");

  let maxChroma = DEFAULT_SETTINGS.maxChroma;
  if (maxChromaRaw !== null) {
    const n = Number(maxChromaRaw);
    // max-chroma is encoded ×1000 like everything else
    if (Number.isFinite(n)) maxChroma = dec(n);
  }

  const ceilingGamut =
    ceilingRaw === "srgb" || ceilingRaw === "p3" || ceilingRaw === "rec2020"
      ? ceilingRaw
      : DEFAULT_SETTINGS.ceilingGamut;

  return {
    steps,
    maxChroma,
    ceilingGamut,
    propagateChanges: DEFAULT_SETTINGS.propagateChanges,
    propagateDecay: DEFAULT_SETTINGS.propagateDecay,
  };
}

// ---------------------------------------------------------------------------
// Helpers — serialize individual fields
// ---------------------------------------------------------------------------

function curveToString(curve: Curve, steps: string[]): string {
  return steps.map((s) => enc(curve[s])).join(",");
}

function parseSteps(params: URLSearchParams): string[] {
  const raw = params.get("steps");
  if (!raw) return [...DEFAULT_STEPS];
  const steps = raw.split(",").filter(Boolean);
  if (steps.length === 0) return [...DEFAULT_STEPS];
  return steps;
}

function stepsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}
