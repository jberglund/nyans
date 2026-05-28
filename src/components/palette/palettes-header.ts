import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { store } from "../../state/store";
import "../shared/number-slider";
import { linkedEditingTip, spreadTip } from "../shared/tool-tip-content";
import type { State } from "../../state/types";

/**
 * Header bar above the palette list.
 * Left: "Palettes" heading + add button. Right: Linked editing + Spread.
 */
class PalettesHeader extends HTMLElement {
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
        <div class="stack-horizontal gap-m items-center mb-2xl">
          <h2>Palettes</h2>
          <button class="button" @click=${this.#addPalette}>
            <svg class="icon" viewBox="0 0 24 24"><use href="#icon-plus" /></svg>
            Add palette
          </button>

          <div class="stack-horizontal gap-m ml-auto items-stretch">
            <label class=" inline-flex items-center gap-xs" hotkey-key="l" hotkey-restore-focus>
              <input
                id="linked-editing"
                class="checkbox"
                type="checkbox"
                .checked=${settings.propagateChanges}
                @change=${this.#onPropagateToggle}
              />
              <span class="label"
                >Linked editing<tool-tip class="ml-2xs">${linkedEditingTip}</tool-tip></span
              >
            </label>

            <label class=" inline-flex items-center gap-xs">
              <span class="label">Spread<tool-tip class="ml-2xs">${spreadTip}</tool-tip></span>
              <number-slider>
                <input
                  id="spread-decay"
                  class="input"
                  type="number"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  .value=${live(String(settings.propagateDecay))}
                  ?disabled=${!settings.propagateChanges}
                  @input=${this.#onPropagateDecayInput}
                />
              </number-slider>
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

  #addPalette = () => store.addDefaultPalette();

  #onPropagateToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    store.setPropagateChanges(checked);
  };

  #onPropagateDecayInput = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) store.setPropagateDecay(value);
  };
}

customElements.define("palettes-header", PalettesHeader);
