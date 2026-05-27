import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { store } from "../state/store";
import { generateExport, FORMAT_LABELS, type ExportFormat } from "../export";
import type { State } from "../state/types";

/**
 * Modal dialog for exporting palettes as CSS, DTCG, or JSON.
 *
 * Usage: call `openExportDialog()` from anywhere. The dialog is a singleton.
 */
class ExportDialog extends HTMLElement {
  #unsub: (() => void) | null = null;

  #format: ExportFormat = "css";
  #paletteIds: string[] = [];
  #names: Record<string, string> = {};
  #prefix = "";
  #initialized = false;

  connectedCallback() {
    // Seed with all current palette IDs on first connect
    if (!this.#initialized) {
      const state = store.getState();
      const ids = Object.keys(state.palettes);
      this.#paletteIds = ids;
      for (const id of ids) this.#names[id] = state.palettes[id].name;
      this.#initialized = true;
    }
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  // --- public API ---

  open() {
    // Ensure any newly added palettes are selected by default
    const state = store.getState();
    const currentIds = Object.keys(state.palettes);
    for (const id of currentIds) {
      if (!this.#paletteIds.includes(id)) {
        this.#paletteIds = [...this.#paletteIds, id];
        this.#names[id] = state.palettes[id].name;
      }
    }
    // Remove stale IDs from selection and names
    this.#paletteIds = this.#paletteIds.filter((id) => currentIds.includes(id));
    for (const id of Object.keys(this.#names)) {
      if (!currentIds.includes(id)) delete this.#names[id];
    }
    this.#render();

    const popover = this.querySelector(".export-dialog") as HTMLElement | null;
    if (popover && !popover.matches(":popover-open")) {
      popover.showPopover();
    }
  }

  close() {
    const popover = this.querySelector(".export-dialog") as HTMLElement | null;
    popover?.hidePopover();
  }

  // --- render ---

  #render() {
    const state = store.getState();
    const allIds = Object.keys(state.palettes);
    const output = generateExport(state, {
      format: this.#format,
      paletteIds: this.#paletteIds,
      prefix: this.#prefix,
      names: this.#names,
    });

    render(
      html`
        <div class="export-dialog border-default shadow-dialog p-0" popover="auto">
          <div class="stack gap-m p-l">
            <h2 class="export-dialog__title">Export Palettes</h2>

            <!-- Top row: format + prefix, full width -->
            <div class="stack-horizontal gap-m items-end">
              <label class="stack gap-3xs flex-1">
                <span class="export-dialog__label">Format</span>
                <select .value=${this.#format} @change=${this.#onFormatChange}>
                  ${Object.entries(FORMAT_LABELS).map(
                    ([value, label]) =>
                      html`<option value="${value}" ?selected=${this.#format === value}>
                        ${label}
                      </option>`,
                  )}
                </select>
              </label>

              <label class="stack gap-3xs flex-1">
                <span class="export-dialog__label">Name prefix</span>
                <input
                  id="export-prefix"
                  class="input"
                  type="text"
                  .value=${live(this.#prefix)}
                  @input=${this.#onPrefixInput}
                  placeholder="e.g. brand"
                />
              </label>
            </div>

            <!-- Bottom row: palette checkboxes + preview, split -->
            <div class="stack-horizontal gap-m items-start">
              <fieldset class="stack gap-2xs p-s">
                <legend class="export-dialog__label">Palettes</legend>
                ${allIds.map(
                  (id) => html`
                    <label class="stack-horizontal gap-2xs export-dialog__checkbox">
                      <input
                        id="export-palette-${id}"
                        type="checkbox"
                        .checked=${this.#paletteIds.includes(id)}
                        @change=${(e: Event) => this.#onPaletteToggle(id, e)}
                      />
                      <input
                        id="export-name-${id}"
                        class="input"
                        type="text"
                        .value=${live(this.#names[id] ?? id)}
                        @input=${(e: Event) => this.#onNameInput(id, e)}
                        size="10"
                      />
                    </label>
                  `,
                )}
              </fieldset>

              <label class="stack gap-3xs export-dialog__preview-wrapper flex-1">
                <span class="export-dialog__label">Preview</span>
                <textarea
                  class="export-dialog__preview border-default surface-raised"
                  readonly
                  rows="18"
                  spellcheck="false"
                  .value=${output}
                ></textarea>
              </label>
            </div>

            <!-- Actions -->
            <div class="stack-horizontal gap-m justify-end">
              <button class="button" @click=${this.#onDownload}>Download</button>
              <button class="button button--primary" @click=${this.#onCopy}>
                ${this.#copied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button class="button" @click=${this.#onClose}>Close</button>
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

  // --- event handlers ---

  #onFormatChange = (e: Event) => {
    this.#format = (e.target as HTMLSelectElement).value as ExportFormat;
    this.#render();
  };

  #onPaletteToggle = (id: string, e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      this.#paletteIds = [...this.#paletteIds, id];
    } else {
      this.#paletteIds = this.#paletteIds.filter((p) => p !== id);
    }
    this.#render();
  };

  #onNameInput = (id: string, e: Event) => {
    this.#names[id] = (e.target as HTMLInputElement).value || id;
    this.#render();
  };

  #onPrefixInput = (e: Event) => {
    this.#prefix = (e.target as HTMLInputElement).value;
    this.#render();
  };

  #copied = false;

  #onCopy = async () => {
    const output = this.#getOutput();
    try {
      await navigator.clipboard.writeText(output);
      this.#copied = true;
      this.#render();
      setTimeout(() => {
        this.#copied = false;
        this.#render();
      }, 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = output;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      this.#copied = true;
      this.#render();
      setTimeout(() => {
        this.#copied = false;
        this.#render();
      }, 2000);
    }
  };

  #onDownload = () => {
    const output = this.#getOutput();
    const ext = this.#format === "css" ? "css" : "json";
    const filename = `palette.${ext}`;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  #onClose = () => {
    this.close();
  };

  #getOutput(): string {
    const state = store.getState();
    return generateExport(state, {
      format: this.#format,
      paletteIds: this.#paletteIds,
      prefix: this.#prefix,
      names: this.#names,
    });
  }
}

// --- Singleton ---

function getOrCreateDialog(): ExportDialog {
  let el = document.querySelector("export-dialog") as ExportDialog | null;
  if (!el) {
    el = document.createElement("export-dialog") as ExportDialog;
    document.body.appendChild(el);
  }
  return el;
}

/** Public API: open the export dialog from anywhere. */
export function openExportDialog(): void {
  getOrCreateDialog().open();
}

customElements.define("export-dialog", ExportDialog);
export default ExportDialog;
