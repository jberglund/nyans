import "./css/style.css";
import "./theme";
import "./components/shared/gamut-checker";
import "./components/shared/step-slider";
import "./components/bezier/bezier-editor";
import "./components/palette/palette-panel";
import "./components/palette/palette-toolbar";
import "./components/palette/palettes-header";
import "./components/palette/palettes-footer";
import "./components/palette/export-dialog";
import "./components/shared/tool-tip";
import { initHotkeys } from "./utils/hotkey";
import { initUrlSync } from "./state";
import { store } from "./state/store";
import { nextPaletteId } from "./state/palette-utils";
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

let initialSyncDone = false;

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
  const appended: HTMLElement[] = [];
  for (const id of ids) {
    if (!existing.has(id)) {
      const panel = document.createElement("palette-panel");
      panel.setAttribute("palette-id", id);
      parent.appendChild(panel);
      appended.push(panel);
    }
  }

  // Focus the name input of the most recently added palette (skip initial load).
  // The browser's native focus scrolls it into view, and scroll-behavior: smooth
  // on <html> makes that smooth.
  if (initialSyncDone && appended.length > 0) {
    const input =
      appended[appended.length - 1].querySelector<HTMLInputElement>('input[type="text"]');
    input?.focus();
    input?.select();
  }
  initialSyncDone = true;
}
