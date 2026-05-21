import { svg, render } from "lit-html";
import { cubicBezierPoint } from "../state/bezier";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE = 200;
const PAD = 20;
const PW = SIZE - 2 * PAD;
const PH = SIZE - 2 * PAD;
const HANDLE_R = 8;
const CURVE_STEPS = 60;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Normalised (0–1) → SVG pixel.  y flips so 0=top (bright), 1=bottom (dark). */
const toX = (n: number) => PAD + n * PW;
const toY = (n: number) => PAD + n * PH; // n=0 → top, n=1 → bottom

/** SVG pixel → normalised (0–1). */
const fromX = (px: number) => Math.max(0, Math.min(1, (px - PAD) / PW));
const fromY = (py: number) => Math.max(0, Math.min(1, (py - PAD) / PH));

const snap3 = (n: number) => Number(n.toFixed(3));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Cubic-bezier curve editor — 2 draggable shape handles, fixed endpoints.
 *
 * P0 = (0,0) top-left  (bright)  — fixed anchor
 * P3 = (1,1) bottom-right (dark) — fixed anchor
 * P1, P2 — draggable shape handles
 *
 * @attr p1x, p1y, p2x, p2y
 * @fires bezier-change — { p1x, p1y, p2x, p2y }
 */
class BezierEditor extends HTMLElement {
  static get observedAttributes() {
    return ["p1x", "p1y", "p2x", "p2y"];
  }

  #p1x = 0.75;
  #p1y = 0.05;
  #p2x = 0.25;
  #p2y = 0.95;
  #dragging: "p1" | "p2" | null = null;

  connectedCallback() {
    this.#readAttrs();
    this.#render();
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    const v = parseFloat(newValue);
    if (isNaN(v)) return;
    this.#setField(name, v);
    this.#render();
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  #render() {
    const p1x = this.#p1x;
    const p1y = this.#p1y;
    const p2x = this.#p2x;
    const p2y = this.#p2y;

    // Build the curve polyline
    let pts = "";
    for (let i = 0; i <= CURVE_STEPS; i++) {
      const pt = cubicBezierPoint(i / CURVE_STEPS, p1x, p1y, p2x, p2y);
      pts += `${toX(pt.x)},${toY(pt.y)} `;
    }

    render(
      svg`
        <svg
          viewBox="0 0 ${SIZE} ${SIZE}"
          width="${SIZE}" height="${SIZE}"
          style="display:block;touch-action:none;user-select:none"
          @pointermove=${this.#onMove}
          @pointerup=${this.#onUp}
          @pointerleave=${this.#onUp}
        >
          <!-- Plot background -->
          <rect x="${PAD}" y="${PAD}" width="${PW}" height="${PH}" fill="#fafafa" />

          <!-- Grid -->
          ${[1, 2, 3].map(
            (i) => svg`
              <line x1="${PAD + (PW * i) / 4}" y1="${PAD}" x2="${PAD + (PW * i) / 4}" y2="${PAD + PH}" stroke="#e0e0e0" stroke-width="1" />
              <line x1="${PAD}" y1="${PAD + (PH * i) / 4}" x2="${PAD + PW}" y2="${PAD + (PH * i) / 4}" stroke="#e0e0e0" stroke-width="1" />
            `,
          )}

          <!-- Axes -->
          <line x1="${PAD}" y1="${PAD + PH}" x2="${PAD + PW}" y2="${PAD + PH}" stroke="#999" stroke-width="1.5" />
          <line x1="${PAD}" y1="${PAD + PH}" x2="${PAD}" y2="${PAD}" stroke="#999" stroke-width="1.5" />

          <!-- Axis labels -->
          <text x="${PAD + PW / 2}" y="${PAD + PH + 14}" fill="#888" font-size="10" text-anchor="middle" font-family="system-ui,sans-serif">Step →</text>
          <text x="${PAD - 14}" y="${PAD + PH / 2}" fill="#888" font-size="10" text-anchor="middle" font-family="system-ui,sans-serif" transform="rotate(-90,${PAD - 14},${PAD + PH / 2})">Lightness →</text>

          <!-- Endpoint labels -->
          <text x="${PAD - 4}" y="${PAD + 3}" fill="#888" font-size="10" text-anchor="end" font-family="system-ui,sans-serif">Bright</text>
          <text x="${PAD + PW + 4}" y="${PAD + PH + 3}" fill="#888" font-size="10" text-anchor="start" font-family="system-ui,sans-serif">Dark</text>

          <!-- Control line P0(0,0) → P1 -->
          <line x1="${PAD}" y1="${PAD}" x2="${toX(p1x)}" y2="${toY(p1y)}" stroke="#ccc" stroke-width="1" stroke-dasharray="4 3" />

          <!-- Control line P3(1,1) → P2 -->
          <line x1="${PAD + PW}" y1="${PAD + PH}" x2="${toX(p2x)}" y2="${toY(p2y)}" stroke="#ccc" stroke-width="1" stroke-dasharray="4 3" />

          <!-- Curve -->
          <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" />

          <!-- Fixed anchors: P0 and P3 -->
          <circle cx="${PAD}" cy="${PAD}" r="3" fill="#999" />
          <circle cx="${PAD + PW}" cy="${PAD + PH}" r="3" fill="#999" />

          <!-- P1 handle -->
          ${this.#handle(toX(p1x), toY(p1y), this.#dragging === "p1", "p1")}

          <!-- P2 handle -->
          ${this.#handle(toX(p2x), toY(p2y), this.#dragging === "p2", "p2")}
        </svg>
      `,
      this,
    );
  }

  #handle(cx: number, cy: number, active: boolean, which: "p1" | "p2") {
    return svg`
      <circle
        cx="${cx}" cy="${cy}" r="${HANDLE_R}"
        fill="${active ? "#2563eb" : "#fff"}"
        stroke="#2563eb" stroke-width="2"
        style="cursor:grab"
        @pointerdown=${(e: PointerEvent) => this.#start(e, which)}
      />
      <circle cx="${cx}" cy="${cy}" r="2.5" fill="${active ? "#fff" : "#2563eb"}" pointer-events="none" />
    `;
  }

  // -------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------

  #start(e: PointerEvent, which: "p1" | "p2") {
    this.#dragging = which;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.#render();
    e.preventDefault();
  }

  #onMove = (e: PointerEvent) => {
    if (!this.#dragging) return;

    const svgEl = this.querySelector("svg")!;
    const rect = svgEl.getBoundingClientRect();
    const sx = SIZE / rect.width;
    const sy = SIZE / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top) * sy;
    const nx = fromX(px);
    const ny = fromY(py);

    if (this.#dragging === "p1") {
      this.#p1x = nx;
      this.#p1y = ny;
    } else {
      this.#p2x = nx;
      this.#p2y = ny;
    }

    this.#render();
    this.#emitChange();
  };

  #onUp = () => {
    if (this.#dragging) {
      this.#dragging = null;
      this.#render();
    }
  };

  // -------------------------------------------------------------------
  // Events & attrs
  // -------------------------------------------------------------------

  #emitChange() {
    this.dispatchEvent(
      new CustomEvent("bezier-change", {
        detail: {
          p1x: snap3(this.#p1x),
          p1y: snap3(this.#p1y),
          p2x: snap3(this.#p2x),
          p2y: snap3(this.#p2y),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #setField(name: string, v: number) {
    const map: Record<string, () => void> = {
      p1x: () => (this.#p1x = v),
      p1y: () => (this.#p1y = v),
      p2x: () => (this.#p2x = v),
      p2y: () => (this.#p2y = v),
    };
    map[name]?.();
  }

  #readAttrs() {
    const a = (n: string, d: number) => {
      const v = parseFloat(this.getAttribute(n) ?? "");
      return isNaN(v) ? d : v;
    };
    this.#p1x = a("p1x", 0.75);
    this.#p1y = a("p1y", 0.05);
    this.#p2x = a("p2x", 0.25);
    this.#p2y = a("p2y", 0.95);
  }
}

customElements.define("bezier-editor", BezierEditor);
export default BezierEditor;
