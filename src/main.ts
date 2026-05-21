import "./style.css";
import "./components/gamut-checker";
import "./components/step-slider";
import "./components/lightness-editor";
import "./components/palette-panel";
import "./components/palette-toolbar";
import { initHotkeys } from "./hotkey";
import { initUrlSync } from "./state";
import { store } from "./state/store";
import { nextPaletteId } from "./components/palette-toolbar";
import type { PaletteConfig } from "./state/types";

// Hydrate from URL (if params exist) and wire up persistence
initUrlSync();

// Global keyboard shortcuts for hotkey-key attributed elements
initHotkeys();

// ---------------------------------------------------------------------------
// Palette DOM sync
// ---------------------------------------------------------------------------
// Palette-panels are autonomous (they subscribe to the store and re-render
// themselves). Our job is to keep the DOM in sync with state.palettes:
// create elements for new palettes, remove elements for deleted ones.

const container = document.getElementById("palettes");
if (!container) throw new Error("Missing #palettes container");

syncPalettes(container);
store.subscribe(() => syncPalettes(container));

container.addEventListener("palette-clone", (e) => {
  const { config } = (e as CustomEvent<{ paletteId: string; config: PaletteConfig }>).detail;
  const id = nextPaletteId(store.getState());
  store.addPalette(id, config);
});

container.addEventListener("palette-remove", (e) => {
  const { paletteId } = (e as CustomEvent<{ paletteId: string }>).detail;
  if (Object.keys(store.getState().palettes).length > 1) {
    store.removePalette(paletteId);
  }
});

function syncPalettes(parent: HTMLElement) {
  const ids = Object.keys(store.getState().palettes);
  const existing = new Map<string, Element>();
  for (const el of parent.querySelectorAll("palette-panel")) {
    const id = el.getAttribute("palette-id");
    if (id) existing.set(id, el);
  }

  // Remove stale elements
  for (const [id, el] of existing) {
    if (!ids.includes(id)) el.remove();
  }

  // Append new elements (maintain insertion order)
  for (const id of ids) {
    if (!existing.has(id)) {
      const panel = document.createElement("palette-panel");
      panel.setAttribute("palette-id", id);
      parent.appendChild(panel);
    }
  }
}
