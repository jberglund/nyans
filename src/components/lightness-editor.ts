import { html, render } from "lit-html";
import { store } from "../state/store";
import { STEPS, type Step } from "../state";
import type { State, Curve } from "../state/types";
import {
  type BezierControls,
  bezierToCurve,
  BEZIER_PRESETS,
  DEFAULT_START_L,
  DEFAULT_END_L,
} from "../state/bezier";
import "./step-slider";
import "./bezier-editor";

/**
 * Lightness editor with a bezier curve control, start/end lightness inputs,
 * and per-step sliders for fine-tuning.
 */
class LightnessEditor extends HTMLElement {
  #unsub: (() => void) | null = null;

  #bezier: BezierControls = BEZIER_PRESETS[0].controls;
  #startL = DEFAULT_START_L;
  #endL = DEFAULT_END_L;
  #activePresetKey: string | null = BEZIER_PRESETS[0].key;

  connectedCallback() {
    this.addEventListener("step-change", this.#onStepChange);
    this.addEventListener("bezier-change", this.#onBezierChange);
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  #render() {
    const state = store.getState();

    render(
      html`
        <section class="lightness-section the-grid">
          <div class="the-grid__origin">
            <div class="stack" style="gap: 0.5rem;">
              <div class="stack-horizontal" style="gap: 0.35rem; align-items: center;">
                <span>Lightness</span>
                <button class="button" data-size="small" @click=${this.#onReset}>Reset</button>
              </div>

              <bezier-editor
                p1x="${this.#bezier.p1x}"
                p1y="${this.#bezier.p1y}"
                p2x="${this.#bezier.p2x}"
                p2y="${this.#bezier.p2y}"
              ></bezier-editor>

              <div class="stack-horizontal" style="gap: 0.35rem;">
                <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.2rem;">
                  Start
                  <input
                    class="origin-text"
                    type="number"
                    min="0"
                    max="1"
                    step="0.001"
                    .value="${this.#startL}"
                    @input=${this.#onStartChange}
                    style="width:5.5ch"
                  />
                </label>
                <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.2rem;">
                  End
                  <input
                    class="origin-text"
                    type="number"
                    min="0"
                    max="1"
                    step="0.001"
                    .value="${this.#endL}"
                    @input=${this.#onEndChange}
                    style="width:5.5ch"
                  />
                </label>
              </div>

              <select @change=${this.#onPresetChange}>
                <option value="" ?selected=${this.#activePresetKey === null}>Custom…</option>
                ${BEZIER_PRESETS.map(
                  (p) => html`
                    <option value="${p.key}" ?selected=${this.#activePresetKey === p.key}>
                      ${p.label}
                    </option>
                  `,
                )}
              </select>
            </div>
          </div>
          <div class="the-grid__steps palette-grid" data-editor="lightness">
            ${STEPS.map(
              (step) =>
                html`<step-slider
                  step-key="${step}"
                  value="${state.lightness[step]}"
                  min="0"
                  max="1"
                  orient="vertical"
                  show-label
                ></step-slider>`,
            )}
          </div>
        </section>
      `,
      this,
    );
  }

  // -------------------------------------------------------------------
  // Store subscription
  // -------------------------------------------------------------------

  #onStoreChange = (_state: State) => {
    const curve = _state.lightness;
    const matched = BEZIER_PRESETS.find((p) =>
      curvesEqual(curve, bezierToCurve(p.controls, this.#startL, this.#endL)),
    );
    this.#activePresetKey = matched ? matched.key : null;
    if (matched) {
      this.#bezier = { ...matched.controls };
    }
    this.#render();
  };

  // -------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------

  #pushCurve() {
    store.setLightnessCurve(bezierToCurve(this.#bezier, this.#startL, this.#endL));
  }

  #onBezierChange = (e: Event) => {
    const { p1x, p1y, p2x, p2y } = (e as CustomEvent<BezierControls>).detail;
    this.#bezier = { p1x, p1y, p2x, p2y };
    this.#activePresetKey = findMatchingPreset(this.#bezier);
    this.#pushCurve();
  };

  #onStartChange = (e: Event) => {
    this.#startL = parseFloat((e.target as HTMLInputElement).value);
    this.#activePresetKey = null;
    this.#pushCurve();
  };

  #onEndChange = (e: Event) => {
    this.#endL = parseFloat((e.target as HTMLInputElement).value);
    this.#activePresetKey = null;
    this.#pushCurve();
  };

  #onStepChange = (e: Event) => {
    const { step, value } = (e as CustomEvent<{ step: Step; value: number }>).detail;
    store.setLightness(step, value);
    this.#activePresetKey = null;
    this.#render();
  };

  #onReset = () => {
    const preset = BEZIER_PRESETS[0];
    this.#bezier = { ...preset.controls };
    this.#startL = DEFAULT_START_L;
    this.#endL = DEFAULT_END_L;
    this.#activePresetKey = preset.key;
    this.#pushCurve();
  };

  #onPresetChange = (e: Event) => {
    const key = (e.target as HTMLSelectElement).value;
    const preset = BEZIER_PRESETS.find((p) => p.key === key);
    if (preset) {
      this.#bezier = { ...preset.controls };
      this.#activePresetKey = preset.key;
      this.#pushCurve();
    }
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function curvesEqual(a: Curve, b: Curve): boolean {
  for (const step of STEPS) {
    if (a[step] !== b[step]) return false;
  }
  return true;
}

function findMatchingPreset(c: BezierControls): string | null {
  for (const p of BEZIER_PRESETS) {
    if (
      p.controls.p1x === c.p1x &&
      p.controls.p1y === c.p1y &&
      p.controls.p2x === c.p2x &&
      p.controls.p2y === c.p2y
    ) {
      return p.key;
    }
  }
  return null;
}

customElements.define("lightness-editor", LightnessEditor);
export default LightnessEditor;
