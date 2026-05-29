import { html, render } from "lit-html";
import { store } from "../../state/store";
import { deriveSwatches, maxInGamutChroma, type Step } from "../../state";
import type { State, PaletteConfig } from "../../state/types";
import "../shared/step-slider";
import "./palette-origin";

/**
 * A single palette: origin editor, swatches, per-step chroma sliders, and
 * clone / remove actions.
 *
 * @attr palette-id - The palette key in the store ("p1", "p2", etc.)
 *
 * @fires palette-clone - { paletteId: string, config: PaletteConfig }
 * @fires palette-remove - { paletteId: string }
 */
class PalettePanel extends HTMLElement {
  static get observedAttributes() {
    return ["palette-id"];
  }

  #paletteId = "p1";
  #unsub: (() => void) | null = null;
  #shiftHeld = false;

  connectedCallback() {
    this.#paletteId = this.getAttribute("palette-id") ?? "p1";
    this.addEventListener("step-change", this.#onStepChange);
    this.addEventListener("origin-change", this.#onOriginChange);
    document.addEventListener("keydown", this.#onKeyDown);
    document.addEventListener("keyup", this.#onKeyUp);
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#unsub?.();
    document.removeEventListener("keydown", this.#onKeyDown);
    document.removeEventListener("keyup", this.#onKeyUp);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  #render() {
    const state = store.getState();
    const palette = state.palettes[this.#paletteId];
    if (!palette) return;

    const { maxChroma: sliderMax, ceilingGamut, steps } = state.settings;
    const paletteCount = Object.keys(state.palettes).length;
    const swatches = deriveSwatches(state, this.#paletteId);

    render(
      html`
        <section class="stack gap-l">
          <div class=" stack-horizontal gap-s items-end">
            <label class="stack gap-2xs" for="palette-name-${this.#paletteId}">
              <div class="label">Name</div>
              <input
                id="palette-name-${this.#paletteId}"
                type="text"
                class="input "
                data-size="large"
                .value=${palette.name}
                placeholder="Palette name"
                aria-label="Palette name"
                @change=${this.#onNameChange}
              />
            </label>

            <palette-origin
              palette-id="${this.#paletteId}"
              l="${palette.origin.l}"
              c="${palette.origin.c}"
              h="${palette.origin.h}"
            ></palette-origin>
            <div class="ml-auto stack-horizontal gap-s">
              <button class="button" title="Clone palette" @click=${this.#onCloneClick}>
                <svg class="icon" viewBox="0 0 24 24"><use href="#icon-clone" /></svg>
                Clone
              </button>
              <button
                class="button"
                title="Remove palette"
                ?disabled=${paletteCount <= 1}
                @click=${this.#onRemoveClick}
              >
                <svg class="icon" viewBox="0 0 24 24"><use href="#icon-remove" /></svg>
                Remove
              </button>
            </div>
          </div>
          <div class="stack gap-m overflow-scroll">
            <div class="palette-grid" data-palette-grid>
              ${swatches.map(
                (swatch) => html`
                  <div class="palette-swatch" style="background-color: ${swatch.css}">
                    <span hidden class="swatch-label">${swatch.step}</span>
                    ${swatch.gamut !== "srgb"
                      ? html`<span class="swatch-gamut-badge">${swatch.gamut}</span>`
                      : ""}
                  </div>
                `,
              )}
            </div>
            <div class="palette-grid" data-editor="chroma">
              ${steps.map((step) => {
                const L = state.lightness[step];
                const ceiling = maxInGamutChroma(L, palette.origin.h, ceilingGamut);
                return html`
                  <step-slider
                    step-key="${step}"
                    value="${palette.chroma[step]}"
                    min="0"
                    max="${sliderMax}"
                    ceiling="${ceiling}"
                    orient="vertical"
                  ></step-slider>
                `;
              })}
            </div>
          </div>
        </section>
      `,
      this,
    );
  }

  // -----------------------------------------------------------------------
  // Store subscription
  // -----------------------------------------------------------------------

  #onStoreChange = (_state: State) => {
    this.#render();
  };

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  #onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Shift" && !e.repeat) {
      this.#shiftHeld = true;
    }
  };

  #onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Shift") {
      this.#shiftHeld = false;
    }
  };

  #onStepChange = (e: Event) => {
    const { step, value } = (e as CustomEvent<{ step: Step; value: number }>).detail;
    const { propagateChanges } = store.getState().settings;
    store.setChroma(this.#paletteId, step, value, propagateChanges !== this.#shiftHeld);
  };

  #onOriginChange = (e: Event) => {
    const { l, c, h } = (e as CustomEvent<{ l: number; c: number; h: number }>).detail;
    store.setOrigin(this.#paletteId, l, c, h);
  };

  #onNameChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    store.setPaletteName(this.#paletteId, value);
  };

  #onCloneClick = () => {
    const state = store.getState();
    const palette = state.palettes[this.#paletteId];
    if (!palette) return;

    const cloneConfig: PaletteConfig = {
      chroma: { ...palette.chroma },
      origin: { ...palette.origin },
      name: `${palette.name} (copy)`,
    };

    this.dispatchEvent(
      new CustomEvent("palette-clone", {
        detail: { paletteId: this.#paletteId, config: cloneConfig },
        bubbles: true,
        composed: true,
      }),
    );
  };

  #onRemoveClick = () => {
    this.dispatchEvent(
      new CustomEvent("palette-remove", {
        detail: { paletteId: this.#paletteId },
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define("palette-panel", PalettePanel);
