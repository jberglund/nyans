import { html, render } from "lit-html";
import { store } from "../../state/store";
import { deriveSwatches } from "../../state";
import type { State } from "../../state/types";

/**
 * Full-viewport popover that previews all palettes as a table — step labels
 * across the top, palette names down the left, swatch colors filling the grid.
 *
 * Usage: call `openPalettesPreview()` from anywhere. The element is created
 * on demand and removed from the DOM when the popover closes.
 */
class PalettesPreview extends HTMLElement {
  #unsub: (() => void) | null = null;

  connectedCallback() {
    this.#unsub = store.subscribe(this.#onStoreChange);
    this.addEventListener("toggle", this.#onToggle);
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  // --- public API ---

  open() {
    this.#render();
    const popover = this.querySelector(".palettes-preview") as HTMLElement | null;
    popover?.showPopover();
  }

  close() {
    const popover = this.querySelector(".palettes-preview") as HTMLElement | null;
    popover?.hidePopover();
  }

  // --- render ---

  #render() {
    const state = store.getState();
    const steps = state.settings.steps;
    const ids = Object.keys(state.palettes);

    render(
      html`
        <div class="palettes-preview" popover="auto">
          <div class="stack-horizontal items-center px-m py-s border-bottom-default">
            <h5 class="m-0 mr-auto">Palette Preview</h5>
            <label class="stack-horizontal items-center gap-xs ml-auto">
              <input type="checkbox" class="checkbox" @change=${this.#onToggleGrayscale} />
              <span class="fs-s">Grayscale</span>
            </label>
          </div>
          <div class="palettes-preview__body p-m">
            <div
              class="grid"
              style="grid-template-columns: auto repeat(${steps.length}, 1fr); grid-template-rows: auto; grid-auto-rows: minmax(5rem, 1fr);"
            >
              <div class="palettes-preview-head">
                <div></div>
                ${steps.map(
                  (step) => html`
                    <div class="palettes-preview-header fs-s t-bold t-center text-low py-2xs px-xs">
                      ${step}
                    </div>
                  `,
                )}
              </div>
              ${ids.map((id) => {
                const palette = state.palettes[id];
                const swatches = deriveSwatches(state, id);
                return html`
                  <div class="palettes-preview-row">
                    <div class="palettes-preview-name t-bold stack-horizontal py-xs px-s">
                      ${palette.name}
                    </div>
                    ${swatches.map(
                      (swatch) => html`
                        <div
                          class="palettes-preview-swatch"
                          style="background-color: ${swatch.css};"
                        ></div>
                      `,
                    )}
                  </div>
                `;
              })}
            </div>
          </div>
        </div>
      `,
      this,
    );
  }

  // --- store ---

  #onStoreChange = (_state: State) => {
    this.#render();
  };

  // --- events ---

  // The Popover API fires `toggle` for all close paths (button, Escape,
  // light-dismiss). We defer removal with a microtask so the browser
  // finishes closing the popover before we pull the element from the DOM.
  #onToggle = (e: Event) => {
    if ((e as ToggleEvent).newState === "closed") {
      queueMicrotask(() => this.remove());
    }
  };

  #onToggleGrayscale = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    const body = this.querySelector(".palettes-preview__body") as HTMLElement | null;
    body?.classList.toggle("grayscale", checked);
  };
}

// --- singleton ---

function getOrCreatePreview(): PalettesPreview {
  let el = document.querySelector("palettes-preview") as PalettesPreview | null;
  if (!el) {
    el = document.createElement("palettes-preview") as PalettesPreview;
    document.body.appendChild(el);
  }
  return el;
}

/** Open the full-viewport palette preview. */
export function openPalettesPreview(): void {
  getOrCreatePreview().open();
}

customElements.define("palettes-preview", PalettesPreview);
