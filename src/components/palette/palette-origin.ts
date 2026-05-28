import Color from "colorjs.io";
import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { originToHex } from "../../state";

/**
 * Origin color editor: swatch, color picker, hex input, OKLCH readout.
 *
 * @attr l         - Lightness (0-1)
 * @attr c         - Chroma (0-0.6)
 * @attr h         - Hue (0-360)
 * @attr palette-id - Used for unique input IDs
 *
 * @fires origin-change - { l: number, c: number, h: number }
 */
class PaletteOrigin extends HTMLElement {
  static get observedAttributes() {
    return ["l", "c", "h", "palette-id"];
  }

  #l = 0.62;
  #c = 0.18;
  #h = 264;
  #paletteId = "p1";

  connectedCallback() {
    this.#syncAttrs();
    this.#render();
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    if (name === "l") this.#l = parseFloat(newValue) || 0.62;
    if (name === "c") this.#c = parseFloat(newValue) || 0.18;
    if (name === "h") this.#h = parseFloat(newValue) || 264;
    if (name === "palette-id") this.#paletteId = newValue || "p1";
    this.#render();
  }

  #syncAttrs() {
    this.#l = parseFloat(this.getAttribute("l") ?? "") || 0.62;
    this.#c = parseFloat(this.getAttribute("c") ?? "") || 0.18;
    this.#h = parseFloat(this.getAttribute("h") ?? "") || 264;
    this.#paletteId = this.getAttribute("palette-id") ?? "p1";
  }

  #render() {
    const hex = originToHex({ l: this.#l, c: this.#c, h: this.#h });

    render(
      html`
        <div class="stack-horizontal gap-m">
          <div class="stack gap-2xs">
            <div class="label">Origin color</div>
            <div class="overlap">
              <label
                class="origin-swatch self-stretch self-justify-start"
                for="origin-${this.#paletteId}"
                style="background-color: oklch(${this.#l.toFixed(3)} ${this.#c.toFixed(
                  3,
                )} ${this.#h.toFixed(1)})"
                title="Click to change origin color"
              ></label>
              <input
                type="color"
                .value=${live(hex)}
                id="origin-${this.#paletteId}"
                name="origin"
                @input=${this.#onColorInput}
              />
              <input
                id="origin-text-${this.#paletteId}"
                type="text"
                data-size="large"
                class="input pl-xl"
                .value=${hex}
                placeholder="#000000"
                aria-label="Origin color value"
                @change=${this.#onTextInput}
              />
            </div>
          </div>
          <div class="mt-auto p-2xs">
            <span>=</span>
            <div class="inline-flex gap-xs fs-xs t-tabular text-mid">
              <span> L </span>
              <span class="t-bold text-high">${this.#l.toFixed(3)}</span>
            </div>

            <div class="inline-flex gap-xs fs-xs t-tabular text-mid">
              <span> C </span>
              <span class="t-bold text-high">${this.#c.toFixed(3)}</span>
            </div>
            <div class="inline-flex gap-xs fs-xs t-tabular text-mid">
              <span> H </span>
              <span class="t-bold text-high">${this.#h.toFixed(1)}°</span>
            </div>
          </div>
        </div>
      `,
      this,
    );
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  #onColorInput = () => {
    const input = this.querySelector<HTMLInputElement>("input[type='color']");
    if (!input) return;
    try {
      const color = new Color(input.value);
      const [l = 0.5, c = 0.15, h = 264] = color.oklch as number[];
      this.#emitChange(l, c, h);
    } catch {
      // Unparseable color — ignore
    }
  };

  #onTextInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    try {
      const color = new Color(value);
      const [l = 0.5, c = 0.15, h = 264] = color.oklch as number[];
      this.#emitChange(l, c, h);
    } catch {
      // Invalid — reset to current origin hex
      input.value = originToHex({ l: this.#l, c: this.#c, h: this.#h });
    }
  };

  #emitChange(l: number, c: number, h: number) {
    this.dispatchEvent(
      new CustomEvent("origin-change", {
        detail: { l, c, h },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

customElements.define("palette-origin", PaletteOrigin);
