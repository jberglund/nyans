import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";

/**
 * A tiny custom element wrapping an <input type="range">.
 *
 * @attr step-key  - The curve step name ("50", "150", etc.)
 * @attr value     - Initial numeric value
 * @attr min       - Slider minimum
 * @attr max       - Slider maximum
 * @attr orient    - "vertical" (default) or "horizontal"
 * @attr show-label - If present, the step label is visible
 *
 * @fires step-change - { step: string, value: number }
 */
class StepSlider extends HTMLElement {
  static get observedAttributes() {
    return ["step-key", "value", "min", "max", "orient", "show-label", "ceiling"];
  }

  connectedCallback() {
    const stepKey = this.getAttribute("step-key") ?? "";
    const value = this.getAttribute("value") ?? "0";
    const min = this.getAttribute("min") ?? "0";
    const max = this.getAttribute("max") ?? "1";
    const orient = this.getAttribute("orient") ?? "vertical";
    const showLabel = this.hasAttribute("show-label");
    const ceiling = this.getAttribute("ceiling");

    // Light DOM — inherits global CSS from inputs.css and form-controls.css
    render(
      html`
        <label class="step-item stack items-center">
          <span class="fs-xs mb-xs" ?hidden=${!showLabel}>${stepKey}</span>
          <div class="slider-track">
            <div class="ceiling-zone"></div>
            <input
              id="step-range-${stepKey}"
              class="range-input"
              type="range"
              min="${min}"
              max="${max}"
              .value=${live(value)}
              step="0.001"
              orient="${orient}"
              @input=${this.#onRangeInput}
            />
          </div>
          <input
            id="step-number-${stepKey}"
            class="input step-number"
            type="number"
            data-size="small"
            min="${min}"
            max="${max}"
            .value=${live(value)}
            step="0.001"
            @input=${this.#onNumberInput}
          />
        </label>
      `,
      this,
    );

    if (ceiling !== null) {
      this.#setCeilingPos(Number(ceiling), Number(max));
    }
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    if (name === "value") {
      const range = this.querySelector<HTMLInputElement>("input[type='range']");
      const number = this.querySelector<HTMLInputElement>("input[type='number']");
      if (range && document.activeElement !== range) range.value = newValue;
      if (number && document.activeElement !== number) number.value = newValue;
      this.#updateTrackBg();
    }
    if (name === "min" || name === "max") {
      const range = this.querySelector<HTMLInputElement>("input[type='range']");
      const number = this.querySelector<HTMLInputElement>("input[type='number']");
      if (range) range.setAttribute(name, newValue);
      if (number) number.setAttribute(name, newValue);
      // ceiling position depends on max, so recalculate
      const ceiling = this.getAttribute("ceiling");
      if (ceiling !== null) {
        const maxVal = parseFloat(this.getAttribute("max") ?? "1");
        this.#setCeilingPos(parseFloat(ceiling), maxVal);
      }
    }
    if (name === "show-label") {
      const span = this.querySelector<HTMLSpanElement>("span");
      if (span) span.hidden = newValue === null;
    }
    if (name === "ceiling") {
      const max = parseFloat(this.getAttribute("max") ?? "1");
      this.#setCeilingPos(parseFloat(newValue), max);
    }
  }

  #setCeilingPos(ceiling: number, max: number) {
    const pos = max > 0 ? (ceiling / max) * 100 : 100;
    this.style.setProperty("--ceiling-pos", `${pos}`);
    this.#updateTrackBg();
  }

  #updateTrackBg() {
    const range = this.querySelector<HTMLInputElement>("input[type='range']");
    if (!range) return;
    const value = parseFloat(range.value);
    const ceiling = parseFloat(this.getAttribute("ceiling") ?? "0");
    if (value > ceiling) {
      this.setAttribute("out-of-gamut", "");
    } else {
      this.removeAttribute("out-of-gamut");
    }
  }

  #rangeEl() {
    return this.querySelector<HTMLInputElement>("input[type='range']")!;
  }
  #numberEl() {
    return this.querySelector<HTMLInputElement>("input[type='number']")!;
  }

  #onRangeInput = () => {
    const range = this.#rangeEl();
    const number = this.querySelector<HTMLInputElement>("input[type='number']");
    if (number && document.activeElement !== number) {
      number.value = range.value;
    }
    this.#updateTrackBg();
    this.#emitChange(parseFloat(range.value));
  };

  #onNumberInput = () => {
    const number = this.#numberEl();
    const range = this.querySelector<HTMLInputElement>("input[type='range']");
    if (range && document.activeElement !== range) {
      range.value = number.value;
    }
    this.#updateTrackBg();
    this.#emitChange(parseFloat(number.value));
  };

  #emitChange(value: number) {
    const stepKey = this.getAttribute("step-key");
    this.dispatchEvent(
      new CustomEvent("step-change", {
        detail: { step: stepKey, value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

customElements.define("step-slider", StepSlider);
