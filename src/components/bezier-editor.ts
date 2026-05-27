import { svg, html, render } from "lit-html";
import { store } from "../state/store";
import { STEPS } from "../state/types";
import type { State, Curve } from "../state/types";
import { type BezierControls, bezierYAtX, bezierToCurve, BEZIER_PRESETS } from "../state/bezier";
import { snap } from "../state/derive";
import {
  lightnessHeadingTip,
  presetTip,
  bezierEditorTip,
  startLightnessTip,
  endLightnessTip,
} from "./tool-tip-content";
import "./number-slider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 200;
const PAD = 0;
const HANDLE_SIZE = 12;
const HANDLE_DOT_SIZE = 4;
const STEP_DIAMOND_SIZE = 8;
const H_GRID_LINES = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full lightness curve editor.
 *
 * Combines a cubic-bezier shape editor (SVG) with preset selection,
 * start/end lightness inputs, and direct store integration.
 *
 * All four bezier control points are editable:
 *   P0 = (0, p0y) — left-anchored, vertical-drag only  (start lightness)
 *   P3 = (1, p3y) — right-anchored, vertical-drag only (end lightness)
 *   P1, P2 — fully draggable shape handles
 *
 * @attr height — fixed px height for the SVG plot (default 200).
 */
class BezierEditor extends HTMLElement {
  static get observedAttributes() {
    return ["height"];
  }

  // Bezier controls — default to the S-curve shape with default lightness range
  #p0y = BEZIER_PRESETS[0].controls.p0y;
  #p1x = BEZIER_PRESETS[0].controls.p1x;
  #p1y = BEZIER_PRESETS[0].controls.p1y;
  #p2x = BEZIER_PRESETS[0].controls.p2x;
  #p2y = BEZIER_PRESETS[0].controls.p2y;
  #p3y = BEZIER_PRESETS[0].controls.p3y;

  // Preset tracking
  #activePresetKey: string | null = BEZIER_PRESETS[0].key;

  // Drag
  #dragging: "p0" | "p1" | "p2" | "p3" | null = null;

  // Sizing
  #svgHeight = DEFAULT_HEIGHT;
  #actualWidth = 300;
  #resizeObserver: ResizeObserver | null = null;

  // Store
  #unsub: (() => void) | null = null;

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  connectedCallback() {
    this.#readAttrs();
    this.#render();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#unsub?.();
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    if (name === "height") {
      const v = parseFloat(newValue);
      if (!isNaN(v) && v > 0) this.#svgHeight = v;
      this.#render();
    }
  }

  // -------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------

  #observe() {
    this.#resizeObserver?.disconnect();
    const svgEl = this.querySelector("svg");
    if (!svgEl) return;
    this.#resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && Math.abs(rect.width - this.#actualWidth) > 0.5) {
        this.#actualWidth = rect.width;
        this.#render();
      }
    });
    this.#resizeObserver.observe(svgEl);
  }

  get #pw() {
    return this.#actualWidth - 2 * PAD;
  }
  get #ph() {
    return this.#svgHeight - 2 * PAD;
  }

  // -------------------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------------------

  #toX = (n: number) => PAD + n * this.#pw;
  #toY = (n: number) => PAD + n * this.#ph;

  #fromX = (px: number) => Math.max(0, Math.min(1, (px - PAD) / this.#pw));
  #fromY = (py: number) => Math.max(0, Math.min(1, (py - PAD) / this.#ph));

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  /** startL = 1 − p0y  (y=0 → bright top, so p0y near 0 means startL near 1) */
  get #startL() {
    return snap(1 - this.#p0y);
  }

  /** endL = 1 − p3y */
  get #endL() {
    return snap(1 - this.#p3y);
  }

  // -------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------

  #pushCurve() {
    store.setLightnessCurve(bezierToCurve(this.#controls));
  }

  get #controls(): BezierControls {
    return {
      p0y: this.#p0y,
      p1x: this.#p1x,
      p1y: this.#p1y,
      p2x: this.#p2x,
      p2y: this.#p2y,
      p3y: this.#p3y,
    };
  }

  #onStoreChange = (_state: State) => {
    const curve = _state.lightness;
    const matched = BEZIER_PRESETS.find((p) => curvesEqual(curve, bezierToCurve(p.controls)));
    this.#activePresetKey = matched ? matched.key : null;
    if (matched) {
      this.#p0y = matched.controls.p0y;
      this.#p1x = matched.controls.p1x;
      this.#p1y = matched.controls.p1y;
      this.#p2x = matched.controls.p2x;
      this.#p2y = matched.controls.p2y;
      this.#p3y = matched.controls.p3y;
    }
    this.#render();
  };

  // -------------------------------------------------------------------
  // Render — full UI
  // -------------------------------------------------------------------

  #render() {
    const startL = this.#startL;
    const endL = this.#endL;
    const activeKey = this.#activePresetKey;

    render(
      html`
        <section class="the-grid">
          <div class="the-grid__configuration">
            <div class="stack gap-s">
              <h3 class="gap-2xs">
                Lightness<tool-tip class="ml-xs">${lightnessHeadingTip}</tool-tip>
              </h3>

              <div class="stack">
                <div class="stack-horizontal">
                  <label class="fs-s" for="preset">Preset</label>
                  <tool-tip class="ml-2xs">${presetTip}</tool-tip>
                </div>
                <div class="stack-horizontal gap-xs">
                  <select id="preset" @change=${this.#onPresetChange} class="flex-1">
                    <option value="" ?selected=${activeKey === null}>Custom…</option>
                    ${BEZIER_PRESETS.map(
                      (p) => html`
                        <option value="${p.key}" ?selected=${activeKey === p.key}>
                          ${p.label}
                        </option>
                      `,
                    )}
                  </select>
                  <button class="button" data-size="small" @click=${this.#onReset}>Reset</button>
                </div>
              </div>

              <div>
                <span>Curve<tool-tip>${bezierEditorTip}</tool-tip></span>
              </div>

              <div class="stack gap-2xs">
                <div class="stack-horizontal items-center">
                  <span class="fs-s">Start</span>
                  <tool-tip class="ml-2xs">${startLightnessTip}</tool-tip>
                  <number-slider class="ml-auto">
                    <input
                      id="start-lightness"
                      class="origin-text border-default t-right"
                      style="width:9ch"
                      type="number"
                      min="0"
                      max="1"
                      step="0.001"
                      .value="${startL}"
                      @input=${this.#onStartChange}
                    />
                  </number-slider>
                </div>
                <div class="stack-horizontal items-center">
                  <span class="fs-s">End</span>
                  <tool-tip class="ml-2xs">${endLightnessTip}</tool-tip>
                  <number-slider class="ml-auto">
                    <input
                      id="end-lightness"
                      class="origin-text border-default t-right"
                      style="width:9ch"
                      type="number"
                      min="0"
                      max="1"
                      step="0.001"
                      .value="${endL}"
                      @input=${this.#onEndChange}
                    />
                  </number-slider>
                </div>
              </div>
            </div>
          </div>

          <div class="the-grid__steps">${this.#renderSvg()}</div>
        </section>
      `,
      this,
    );

    // Re-attach ResizeObserver to newly rendered SVG
    this.#observe();
  }

  // -------------------------------------------------------------------
  // Render — SVG plot
  // -------------------------------------------------------------------

  #renderSvg() {
    const h = this.#svgHeight;
    const pw = this.#pw;
    const ph = this.#ph;
    const toX = this.#toX;
    const toY = this.#toY;
    const num = STEPS.length;
    const c = this.#controls;

    // Step diamonds — one per palette stop, centered in equal columns
    const halfStep = STEP_DIAMOND_SIZE / 2;
    const stepDiamonds = STEPS.map((_step, i) => {
      const t = (i + 0.5) / num;
      const y = bezierYAtX(t, c);
      const cx = toX(t);
      const cy = toY(y);
      return svg`
        <g transform="rotate(45 ${cx} ${cy})">
          <rect
            x="${cx - halfStep}" y="${cy - halfStep}"
            width="${STEP_DIAMOND_SIZE}" height="${STEP_DIAMOND_SIZE}"
            rx="1.5" ry="1.5"
            class="bezier-editor__step-diamond"
          />
        </g>
      `;
    });

    // Vertical grid lines — column boundaries between step circles
    const vGrid = Array.from({ length: num - 1 }, (_, i) => {
      const x = PAD + ((i + 1) / num) * pw;
      return svg`
        <line x1="${x}" y1="${PAD}" x2="${x}" y2="${PAD + ph}" class="bezier-editor__grid-line" />
      `;
    });

    // Horizontal grid lines — evenly spaced across the plot height
    const hGrid = Array.from({ length: H_GRID_LINES }, (_, i) => {
      const y = PAD + ((i + 1) / (H_GRID_LINES + 1)) * ph;
      return svg`
        <line x1="${PAD}" y1="${y}" x2="${PAD + pw}" y2="${y}" class="bezier-editor__grid-line" />
      `;
    });

    // Anchor positions
    const p0x = PAD;
    const p0y = toY(c.p0y);
    const p3x = PAD + pw;
    const p3y = toY(c.p3y);

    return svg`
      <svg
        width="100%" height="${h}"
        class="bezier-editor__svg"
        @pointermove=${this.#onMove}
        @pointerup=${this.#onUp}
        @pointerleave=${this.#onUp}
      >
        <!-- Plot background -->
        <rect x="${PAD}" y="${PAD}" width="${pw}" height="${ph}" class="bezier-editor__plot-bg" rx="6" />

        <g class="bezier-editor__grid">
          ${vGrid}
          ${hGrid}
        </g>

        <g class="bezier-editor__steps">
          ${stepDiamonds}
        </g>

        <g class="bezier-editor__axes">
          <line x1="${PAD}" y1="${PAD + ph}" x2="${PAD + pw}" y2="${PAD + ph}" class="bezier-editor__axis" />
          <line x1="${PAD}" y1="${PAD + ph}" x2="${PAD}" y2="${PAD}" class="bezier-editor__axis" />
        </g>

        <g class="bezier-editor__curve">
          <line x1="${p0x}" y1="${p0y}" x2="${toX(c.p1x)}" y2="${toY(c.p1y)}" class="bezier-editor__control-line" />
          <line x1="${p3x}" y1="${p3y}" x2="${toX(c.p2x)}" y2="${toY(c.p2y)}" class="bezier-editor__control-line" />
          ${this.#anchorHandle(p0x, p0y, this.#dragging === "p0", "p0")}
          ${this.#handle(toX(c.p1x), toY(c.p1y), this.#dragging === "p1", "p1")}
          ${this.#handle(toX(c.p2x), toY(c.p2y), this.#dragging === "p2", "p2")}
          ${this.#anchorHandle(p3x, p3y, this.#dragging === "p3", "p3")}
        </g>
      </svg>
    `;
  }

  /** Draggable diamond handle for P1 / P2. */
  #handle(cx: number, cy: number, active: boolean, which: "p1" | "p2") {
    const activeMod = active ? " bezier-editor__handle--active" : "";
    const dotActiveMod = active ? " bezier-editor__handle-dot--active" : "";
    const half = HANDLE_SIZE / 2;
    const halfDot = HANDLE_DOT_SIZE / 2;
    return svg`
      <g transform="rotate(45 ${cx} ${cy})">
        <rect
          x="${cx - half}" y="${cy - half}"
          width="${HANDLE_SIZE}" height="${HANDLE_SIZE}"
          rx="2.5" ry="2.5"
          class="bezier-editor__handle${activeMod}"
          @pointerdown=${(e: PointerEvent) => this.#start(e, which)}
        />
        <rect
          x="${cx - halfDot}" y="${cy - halfDot}"
          width="${HANDLE_DOT_SIZE}" height="${HANDLE_DOT_SIZE}"
          rx="1" ry="1"
          class="bezier-editor__handle-dot${dotActiveMod}"
        />
      </g>
    `;
  }

  /** Draggable diamond handle for P0 / P3 (endpoint anchors, vertical-only). */
  #anchorHandle(cx: number, cy: number, active: boolean, which: "p0" | "p3") {
    const activeMod = active ? " bezier-editor__handle--active" : "";
    const dotActiveMod = active ? " bezier-editor__handle-dot--active" : "";
    const half = HANDLE_SIZE / 2;
    const halfDot = HANDLE_DOT_SIZE / 2;
    return svg`
      <g transform="rotate(45 ${cx} ${cy})">
        <rect
          x="${cx - half}" y="${cy - half}"
          width="${HANDLE_SIZE}" height="${HANDLE_SIZE}"
          rx="2.5" ry="2.5"
          class="bezier-editor__handle bezier-editor__handle--anchor${activeMod}"
          @pointerdown=${(e: PointerEvent) => this.#start(e, which)}
        />
        <rect
          x="${cx - halfDot}" y="${cy - halfDot}"
          width="${HANDLE_DOT_SIZE}" height="${HANDLE_DOT_SIZE}"
          rx="1" ry="1"
          class="bezier-editor__handle-dot${dotActiveMod}"
        />
      </g>
    `;
  }

  // -------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------

  #start(e: PointerEvent, which: "p0" | "p1" | "p2" | "p3") {
    this.#dragging = which;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.#render();
    e.preventDefault();
  }

  #onMove = (e: PointerEvent) => {
    if (!this.#dragging) return;

    const svgEl = this.querySelector("svg")!;
    const rect = svgEl.getBoundingClientRect();
    const sx = this.#actualWidth / rect.width;
    const sy = this.#svgHeight / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top) * sy;
    const ny = this.#fromY(py);

    switch (this.#dragging) {
      case "p0":
        // x is fixed at 0
        this.#p0y = ny;
        break;
      case "p1":
        this.#p1x = this.#fromX(px);
        this.#p1y = ny;
        break;
      case "p2":
        this.#p2x = this.#fromX(px);
        this.#p2y = ny;
        break;
      case "p3":
        // x is fixed at 1
        this.#p3y = ny;
        break;
    }

    this.#activePresetKey = findMatchingPreset(this.#controls);
    this.#render();
    this.#pushCurve();
  };

  #onUp = () => {
    if (this.#dragging) {
      this.#dragging = null;
      this.#render();
    }
  };

  // -------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------

  #onPresetChange = (e: Event) => {
    const key = (e.target as HTMLSelectElement).value;
    const preset = BEZIER_PRESETS.find((p) => p.key === key);
    if (preset) {
      // Apply the full preset shape including endpoints.
      this.#p0y = preset.controls.p0y;
      this.#p1x = preset.controls.p1x;
      this.#p1y = preset.controls.p1y;
      this.#p2x = preset.controls.p2x;
      this.#p2y = preset.controls.p2y;
      this.#p3y = preset.controls.p3y;
      this.#activePresetKey = preset.key;
      this.#pushCurve();
      this.#render();
    }
  };

  #onReset = () => {
    const c = BEZIER_PRESETS[0].controls;
    this.#p0y = c.p0y;
    this.#p1x = c.p1x;
    this.#p1y = c.p1y;
    this.#p2x = c.p2x;
    this.#p2y = c.p2y;
    this.#p3y = c.p3y;
    this.#activePresetKey = BEZIER_PRESETS[0].key;
    this.#pushCurve();
    this.#render();
  };

  #onStartChange = (e: Event) => {
    this.#p0y = 1 - parseFloat((e.target as HTMLInputElement).value);
    this.#activePresetKey = null;
    this.#pushCurve();
    this.#render();
  };

  #onEndChange = (e: Event) => {
    this.#p3y = 1 - parseFloat((e.target as HTMLInputElement).value);
    this.#activePresetKey = null;
    this.#pushCurve();
    this.#render();
  };

  // -------------------------------------------------------------------
  // Attrs
  // -------------------------------------------------------------------

  #readAttrs() {
    const v = parseFloat(this.getAttribute("height") ?? "");
    if (!isNaN(v) && v > 0) this.#svgHeight = v;
  }
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

/** Match a BezierControls against presets by checking all six values. */
function findMatchingPreset(c: BezierControls): string | null {
  for (const p of BEZIER_PRESETS) {
    if (
      p.controls.p0y === c.p0y &&
      p.controls.p1x === c.p1x &&
      p.controls.p1y === c.p1y &&
      p.controls.p2x === c.p2x &&
      p.controls.p2y === c.p2y &&
      p.controls.p3y === c.p3y
    ) {
      return p.key;
    }
  }
  return null;
}

// -------------------------------------------------------------------
// Define
// -------------------------------------------------------------------

customElements.define("bezier-editor", BezierEditor);
export default BezierEditor;
