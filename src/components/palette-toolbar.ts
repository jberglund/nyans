import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { store } from "../state/store";
import "./number-slider";
import { openExportDialog } from "./export-dialog";
import { maxChromaTip, ceilingTip } from "./tool-tip-content";
import type { State, AppSettings } from "../state/types";

const CEILING_OPTIONS = [
  { value: "srgb", label: "sRGB" },
  { value: "p3", label: "P3" },
  { value: "rec2020", label: "Rec.2020" },
] as const;

/**
 * Top toolbar: export and advanced settings (max chroma, target colorspace).
 */
class PaletteToolbar extends HTMLElement {
  #unsub: (() => void) | null = null;

  connectedCallback() {
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  #render() {
    const { settings } = store.getState();

    render(
      html`
        <div class="stack-horizontal justify-end gap-m items-stretch py-xl">
          <button class="button" @click=${openExportDialog}>Export</button>
          <button class="button" popovertarget="advanced-popover" aria-expanded="false">
            Advanced
          </button>
        </div>

        <div id="advanced-popover" class="advanced-popover" popover="auto">
          <div class="stack gap-s p-m">
            <label
              class="toolbar-setting inline-flex items-center gap-m fs-s surface-raised border-default"
            >
              <span>Max chroma<tool-tip>${maxChromaTip}</tool-tip></span>
              <number-slider>
                <input
                  id="max-chroma"
                  type="number"
                  min="0.2"
                  max="0.4"
                  step="0.01"
                  .value=${live(String(settings.maxChroma))}
                  @input=${this.#onMaxChromaInput}
                />
              </number-slider>
            </label>

            <label
              class="toolbar-setting inline-flex items-center gap-m fs-s surface-raised border-default"
            >
              <span>Target colorspace<tool-tip>${ceilingTip}</tool-tip></span>
              <select .value=${settings.ceilingGamut} @change=${this.#onCeilingChange}>
                ${CEILING_OPTIONS.map(
                  (opt) => html`
                    <option value="${opt.value}" ?selected=${settings.ceilingGamut === opt.value}>
                      ${opt.label}
                    </option>
                  `,
                )}
              </select>
            </label>
          </div>
        </div>
      `,
      this,
    );
  }

  #onStoreChange = (_state: State) => {
    this.#render();
  };

  // --- Settings ---

  #onMaxChromaInput = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) store.setMaxChroma(value);
  };

  #onCeilingChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value as AppSettings["ceilingGamut"];
    store.setCeilingGamut(value);
  };
}

customElements.define("palette-toolbar", PaletteToolbar);
export default PaletteToolbar;
