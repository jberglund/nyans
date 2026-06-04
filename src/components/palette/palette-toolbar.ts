import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { store } from "../../state/store";
import "../shared/number-slider";
import { openExportDialog } from "./export-dialog";
import { openPalettesPreview } from "./palettes-preview";
import { toolTip } from "../shared/tool-tip";
import { popoverHeader } from "../shared/popover-header";
import { maxChromaTip, ceilingTip, spreadTip, chromaSmoothTip } from "../shared/tool-tip-content";
import { getCurrentTheme, toggleTheme } from "../../theme";
import { DEFAULT_STEPS } from "../../state";
import type { State, AppSettings } from "../../state/types";

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
  #stepsDraft: string | null = null;
  #stepsError: string | null = null;

  connectedCallback() {
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  #render() {
    const { settings } = store.getState();
    const theme = getCurrentTheme();

    render(
      html`
        <div class="stack-horizontal gap-m items-stretch py-xl">
          <a href="/nyans/" style="text-decoration: none;" class="fs-m mr-auto text-mid"
            >A color palette generator</a
          >
          <div class="stack-horizontal gap-xs">
            <button
              class="button"
              @click=${() => {
                toggleTheme();
                this.#render();
              }}
            >
              <svg class="icon" viewBox="0 0 24 24">
                <use href=${theme === "dark" ? "#icon-sun" : "#icon-moon"} />
              </svg>
              ${theme === "dark" ? "Light" : "Dark"}
            </button>
            <button class="button" @click=${openPalettesPreview}>
              <svg class="icon" viewBox="0 0 24 24"><use href="#icon-eye" /></svg>
              Preview
            </button>
            <button class="button" @click=${openExportDialog}>
              <svg class="icon" viewBox="0 0 24 24"><use href="#icon-export" /></svg>
              Export
            </button>
            <button class="button" popovertarget="advanced-popover" aria-expanded="false">
              <svg class="icon" viewBox="0 0 24 24"><use href="#icon-advanced" /></svg>
              Advanced
            </button>
            <div
              id="advanced-popover"
              class="advanced-popover border-default surface-raised shadow-dialog mt-xs p-m"
              popover="auto"
            >
              ${popoverHeader("Advanced config", "#icon-advanced")}
              <div class="stack gap-s">
                <label class="p-2xs stack-horizontal items-center gap-xs  surface-raised">
                  <span class="label mr-auto"
                    >Max chroma ${toolTip("max-chroma-tip", "Max chroma", maxChromaTip)}</span
                  >
                  <number-slider>
                    <input
                      id="max-chroma"
                      class="input t-right"
                      style="width: 10ch;"
                      type="number"
                      min="0.2"
                      max="0.4"
                      step="0.01"
                      .value=${live(String(settings.maxChroma))}
                      @input=${this.#onMaxChromaInput}
                    />
                  </number-slider>
                </label>

                <div class="p-2xs surface-raised ">
                  <span class="label fs-s"
                    >Target colorspace
                    ${toolTip("target-colorspace-tip", "Target colorspace", ceilingTip)}</span
                  >
                  <div class="stack-horizontal gap-m mt-xs">
                    ${CEILING_OPTIONS.map(
                      (opt) => html`
                        <label class="stack-horizontal gap-2xs fs-xs" style="cursor: pointer;">
                          <input
                            type="radio"
                            class="radio"
                            name="ceilingGamut"
                            value="${opt.value}"
                            .checked=${settings.ceilingGamut === opt.value}
                            @change=${this.#onCeilingChange}
                          />
                          ${opt.label}
                        </label>
                      `,
                    )}
                  </div>
                </div>

                <label class="p-2xs stack-horizontal items-center gap-xs  surface-raised">
                  <span class="label mr-auto"
                    >Linked edit strength
                    ${toolTip("spread-tip", "Linked edit strength", spreadTip)}</span
                  >
                  <number-slider>
                    <input
                      id="propagate-decay"
                      class="input t-right"
                      style="width: 10ch;"
                      type="number"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      .value=${live(String(settings.propagateDecay))}
                      @input=${this.#onPropagateDecayInput}
                    />
                  </number-slider>
                </label>

                <label class="p-2xs stack-horizontal items-center gap-xs  surface-raised">
                  <span class="label mr-auto"
                    >Curve smoothness
                    ${toolTip("chroma-smooth-tip", "Curve smoothness", chromaSmoothTip)}</span
                  >
                  <number-slider>
                    <input
                      id="chroma-smooth"
                      class="input t-right"
                      style="width: 10ch;"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      .value=${live(String(settings.chromaSmoothFactor))}
                      @input=${this.#onChromaSmoothInput}
                    />
                  </number-slider>
                </label>

                <div class="stack gap-2xs p-2xs surface-raised ">
                  <span class="label fs-s">Steps</span>
                  <div class="stack-horizontal gap-xs items-start">
                    <input
                      class="input flex-1 fs-xs"
                      type="text"
                      placeholder="0,100,200,300,400"
                      .value=${this.#stepsDraft ?? settings.steps.join(",")}
                      @input=${this.#onStepsInput}
                      @keydown=${this.#onStepsKeydown}
                    />
                  </div>
                  <div class="stack-horizontal gap-xs">
                    <button class="button " @click=${this.#onStepsReset}>Reset</button>
                    <button class="button flex-1" @click=${this.#onStepsSave}>Save</button>
                  </div>
                  ${this.#stepsError
                    ? html`<span class="fs-xs" style="color: var(--gamut-warning)"
                        >${this.#stepsError}</span
                      >`
                    : html`<span class="fs-xs text-low mt-xs"
                        >Comma-separated step names. ${settings.steps.length} steps currently.</span
                      >`}
                </div>
              </div>
            </div>
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
    const value = (e.target as HTMLInputElement).value as AppSettings["ceilingGamut"];
    store.setCeilingGamut(value);
  };

  #onPropagateDecayInput = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) store.setPropagateDecay(value);
  };

  #onChromaSmoothInput = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value)) store.setChromaSmoothFactor(value);
  };

  // --- Steps ---

  #onStepsInput = (e: Event) => {
    this.#stepsDraft = (e.target as HTMLInputElement).value;
    this.#stepsError = null;
  };

  #onStepsKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") this.#onStepsSave();
    if (e.key === "Escape") {
      this.#stepsDraft = null;
      this.#stepsError = null;
      this.#render();
    }
  };

  #onStepsSave = () => {
    const raw = this.#stepsDraft;
    if (raw === null) return;

    const steps = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (steps.length < 2) {
      this.#stepsError = "Need at least 2 steps.";
      this.#render();
      return;
    }

    const seen = new Set<string>();
    for (const s of steps) {
      if (seen.has(s)) {
        this.#stepsError = `Duplicate step: "${s}".`;
        this.#render();
        return;
      }
      seen.add(s);
    }

    this.#stepsDraft = null;
    this.#stepsError = null;
    store.setSteps(steps);
  };

  #onStepsReset = () => {
    this.#stepsDraft = null;
    this.#stepsError = null;
    store.setSteps([...DEFAULT_STEPS]);
  };
}

customElements.define("palette-toolbar", PaletteToolbar);
