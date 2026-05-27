import {
  type State,
  type AppSettings,
  STEPS,
  type Curve,
  type PaletteConfig,
  DEFAULT_SETTINGS,
} from "./types";
import { store, type Store } from "./store";
import { snap } from "./derive";

/**
 * Parse the URL hash fragment into application state.
 *
 * All numeric values are stored as integers (×1000) to keep the URL compact.
 * Example: #L=985,970,955&p1=40,60,80&p1-origin=620,180,264000
 */
export function parseHashParams(): State | null {
  const raw = location.hash.slice(1); // strip leading #
  if (!raw) return null;

  const params = new URLSearchParams(raw);

  const lightnessRaw = params.get("L");
  if (!lightnessRaw) return null;

  const lightness = parseCurve(lightnessRaw);
  if (!lightness) return null;

  const palettes: Record<string, PaletteConfig> = {};

  for (const [key, val] of params) {
    // Match p1, p2, etc. — but not p1-origin
    const paletteMatch = key.match(/^p(\d+)$/);
    if (!paletteMatch) continue;

    const chroma = parseCurve(val);
    if (!chroma) continue;

    const originRaw = params.get(`${key}-origin`);
    const origin = originRaw ? parseOrigin(originRaw) : { l: 0.5, c: 0.15, h: 264 };

    const nameRaw = params.get(`${key}-name`);
    const name = nameRaw ? decodeURIComponent(nameRaw) : key;

    palettes[key] = { chroma, origin, name };
  }

  // Require at least one palette
  if (Object.keys(palettes).length === 0) return null;

  const settings = parseSettings(params);

  return { lightness, palettes, settings };
}

/**
 * Serialize current state into a URL hash fragment.
 * Uses replaceState to avoid flooding browser history on every slider drag.
 */
export function syncToUrl(state: State): void {
  const parts = [`L=${curveToString(state.lightness)}`];

  for (const [id, palette] of Object.entries(state.palettes)) {
    parts.push(`${id}=${curveToString(palette.chroma)}`);
    parts.push(
      `${id}-origin=${enc(palette.origin.l)},${enc(palette.origin.c)},${enc(palette.origin.h)}`,
    );
    parts.push(`${id}-name=${encodeURIComponent(palette.name)}`);
  }

  // Settings — only write non-default values to keep URLs clean
  if (state.settings.maxChroma !== DEFAULT_SETTINGS.maxChroma) {
    parts.push(`max-chroma=${state.settings.maxChroma}`);
  }
  if (state.settings.ceilingGamut !== DEFAULT_SETTINGS.ceilingGamut) {
    parts.push(`ceiling=${state.settings.ceilingGamut}`);
  }

  const qs = parts.join("&");
  history.replaceState(null, "", `#${qs}`);
}

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

  return s.subscribe((state) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      syncToUrl(state);
    }, 400);
  });
}

// --- helpers ---

/** Encode a value to its integer representation (×1000). */
function enc(n: number): number {
  return Math.round(n * 1000);
}

/** Decode an integer back, rounded to match snap precision. */
function dec(n: number): number {
  if (Number.isNaN(n)) return 0;
  return snap(n / 1000);
}

function parseCurve(raw: string): Curve | null {
  const parts = raw.split(",").map(Number);
  if (parts.length !== STEPS.length) return null;

  // biome-ignore lint/style/noNonNullAssertion: checked length above
  const curve = {} as Curve;
  for (let i = 0; i < STEPS.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: checked length above
    curve[STEPS[i]!] = dec(parts[i]!);
  }
  return curve;
}

function parseOrigin(raw: string): { l: number; c: number; h: number } {
  const parts = raw.split(",").map(Number);
  return {
    l: dec(parts[0] ?? 500),
    c: dec(parts[1] ?? 150),
    h: dec(parts[2] ?? 264000),
  };
}

function parseSettings(params: URLSearchParams): AppSettings {
  const maxChromaRaw = params.get("max-chroma");
  const ceilingRaw = params.get("ceiling");
  return {
    maxChroma: maxChromaRaw ? parseFloat(maxChromaRaw) : DEFAULT_SETTINGS.maxChroma,
    ceilingGamut:
      ceilingRaw === "srgb" || ceilingRaw === "p3" || ceilingRaw === "rec2020"
        ? ceilingRaw
        : DEFAULT_SETTINGS.ceilingGamut,
    propagateChanges: DEFAULT_SETTINGS.propagateChanges,
    propagateDecay: DEFAULT_SETTINGS.propagateDecay,
  };
}

function curveToString(curve: Curve): string {
  return STEPS.map((s) => enc(curve[s])).join(",");
}
