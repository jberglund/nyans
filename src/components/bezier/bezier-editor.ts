import { html, render } from "lit-html";
import { STEPS } from "../../state";
import {
  BEZIER_PRESETS,
  bezierToCurve,
  constrainControls,
  findMatchingPreset,
} from "../../state/bezier";
import { snap } from "../../state/derive";
import { store } from "../../state/store";
import { renderBezierSvg } from "./bezier-svg";
import type { BezierControls, DragTarget, State } from "../../state/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 250;
const NUDGE = 0.001;
const NUDGE_LARGE = 0.01;

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
 * @attr height — fixed px height for the SVG plot (default 250).
 */
class BezierEditor extends HTMLElement {
  static get observedAttributes() {
    return ["height"];
  }

  #controls: BezierControls = { ...BEZIER_PRESETS[0].controls };
  #activePresetKey: string | null = BEZIER_PRESETS[0].key;
  #dragging: DragTarget | null = null;

  #svgHeight = DEFAULT_HEIGHT;
  #actualWidth = 300;
  #resizeObserver: ResizeObserver | null = null;
  #unsub: (() => void) | null = null;

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  connectedCallback() {
    this.#render();
    this.#observe();
    this.#unsub = store.subscribe(this.#onStoreChange);
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#unsub?.();
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    if (name !== "height") return;
    const v = Number(newValue);
    if (Number.isFinite(v) && v > 0) this.#svgHeight = v;
    if (this.isConnected) this.#render();
  }

  // -------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------

  #observe() {
    if (this.#resizeObserver) return;
    this.#resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && Math.abs(rect.width - this.#actualWidth) > 0.5) {
        this.#actualWidth = rect.width;
        this.#render();
      }
    });
    this.#resizeObserver.observe(this);
  }

  // -------------------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------------------

  #fromX = (px: number) => clamp01(px / this.#actualWidth);
  #fromY = (py: number) => clamp01(py / this.#svgHeight);

  // -------------------------------------------------------------------
  // Derived (snapped for display)
  // -------------------------------------------------------------------

  /** startL = 1 − p0y  (y=0 → bright top, so p0y near 0 means startL near 1) */
  get #startL() {
    return snap(1 - this.#controls.p0y);
  }

  /** endL = 1 − p3y */
  get #endL() {
    return snap(1 - this.#controls.p3y);
  }

  // -------------------------------------------------------------------
  // Commit — apply constraints, sync preset, push to store, re-render
  // -------------------------------------------------------------------

  #commit() {
    this.#controls = constrainControls(this.#controls);
    this.#activePresetKey = findMatchingPreset(this.#controls);
    store.setBezierControls(this.#controls);
    this.#render();
  }

  #onStoreChange = (state: State) => {
    const next = state.bezierControls;
    if (controlsEqual(next, this.#controls)) return;
    this.#controls = { ...next };
    this.#activePresetKey = findMatchingPreset(this.#controls);
    this.#render();
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  #render() {
    const activeKey = this.#activePresetKey;

    render(
      html`
        <section>
          <div>
            <div class="stack-horizontal items-end mb-m">
              <h4 class="label mr-auto">Lightness Curve</h4>
              <div class="stack-horizontal gap-s">
                <label class="label" for="preset">Preset</label>
                <div class="stack-horizontal gap-xs">
                  <select class="select flex-1" id="preset" @change=${this.#onPresetChange}>
                    <option value="" ?selected=${activeKey === null}>Custom…</option>
                    ${BEZIER_PRESETS.map(
                      (p) => html`
                        <option value="${p.key}" ?selected=${activeKey === p.key}>
                          ${p.label}
                        </option>
                      `,
                    )}
                  </select>
                  <button class="button" @click=${this.#onReset}>Reset curve</button>
                </div>
              </div>
            </div>
            <div>${this.#renderSvg()}</div>
            ${this.#renderStepValues()}
          </div>
        </section>
      `,
      this,
    );
  }

  #renderStepValues() {
    const curve = bezierToCurve(this.#controls);
    return html`
      <div class="stack-horizontal justify-around mt-xs">
        ${STEPS.map(
          (step) => html`
            <div class="bezier-editor__step-value">
              <span class="bezier-editor__step-value-label">${step}</span>
              <span class="bezier-editor__step-value-num">${curve[step].toFixed(2)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  #renderSvg() {
    return renderBezierSvg({
      height: this.#svgHeight,
      plotWidth: this.#actualWidth,
      plotHeight: this.#svgHeight,
      controls: this.#controls,
      startValue: this.#startL,
      endValue: this.#endL,
      dragging: this.#dragging,
      onMove: this.#onMove,
      onUp: this.#onUp,
      onPointerDown: this.#onPointerDown,
      onKeyDown: this.#onKeyDown,
    });
  }

  // -------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------

  #onKeyDown = (e: KeyboardEvent, which: DragTarget) => {
    const step = e.shiftKey ? NUDGE_LARGE : NUDGE;
    let dx = 0;
    let dy = 0;

    switch (e.key) {
      case "ArrowUp":
        dy = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowRight":
        dx = step;
        break;
      default:
        return;
    }

    e.preventDefault();
    this.#nudge(which, dx, dy);
    this.#commit();
  };

  #nudge(which: DragTarget, dx: number, dy: number) {
    const c = this.#controls;
    // P0 and P3 are x-locked at 0 and 1 — ignore horizontal nudges.
    if (which === "p1" || which === "p2") {
      c[`${which}x`] = clamp01(c[`${which}x`] + dx);
    }
    c[`${which}y`] = clamp01(c[`${which}y`] + dy);
  }

  // -------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------

  #onPointerDown = (e: PointerEvent, which: DragTarget) => {
    this.#dragging = which;
    const svgEl = this.querySelector("svg");
    svgEl?.setPointerCapture?.(e.pointerId);
    (e.target as Element).closest<SVGGElement>(".bezier-editor__handle-group")?.focus();
    this.#render();
    e.preventDefault();
  };

  #onMove = (e: PointerEvent) => {
    const which = this.#dragging;
    if (!which) return;

    const svgEl = this.querySelector("svg")!;
    const rect = svgEl.getBoundingClientRect();
    const sx = this.#actualWidth / rect.width;
    const sy = this.#svgHeight / rect.height;
    const nx = this.#fromX((e.clientX - rect.left) * sx);
    const ny = this.#fromY((e.clientY - rect.top) * sy);

    const c = this.#controls;
    // P0 and P3 are x-locked at 0 and 1 — only y moves.
    if (which === "p1" || which === "p2") {
      c[`${which}x`] = nx;
    }
    c[`${which}y`] = ny;

    this.#commit();
  };

  #onUp = () => {
    if (!this.#dragging) return;
    this.#dragging = null;
    this.#render();
  };

  // -------------------------------------------------------------------
  // Preset / reset
  // -------------------------------------------------------------------

  #onPresetChange = (e: Event) => {
    const key = (e.target as HTMLSelectElement).value;
    const preset = BEZIER_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    this.#controls = { ...preset.controls };
    this.#commit();
  };

  #onReset = () => {
    this.#controls = { ...BEZIER_PRESETS[0].controls };
    this.#commit();
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function controlsEqual(a: BezierControls, b: BezierControls): boolean {
  return (
    a.p0y === b.p0y &&
    a.p1x === b.p1x &&
    a.p1y === b.p1y &&
    a.p2x === b.p2x &&
    a.p2y === b.p2y &&
    a.p3y === b.p3y
  );
}

// -------------------------------------------------------------------
// Define
// -------------------------------------------------------------------

customElements.define("bezier-editor", BezierEditor);
export default BezierEditor;
