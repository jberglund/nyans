// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_DRAG_DISTANCE = 300; // px to traverse full range
const DRAG_THRESHOLD = 4; // px before drag engages (allows click-to-edit)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Wraps an `<input type="number">` and adds horizontal drag-to-scrub.
 *
 * Usage:
 *   <number-slider drag-distance="200">
 *     <input type="number" min="0" max="1" step="0.001" />
 *   </number-slider>
 *
 * The input is discovered via `querySelector('input[type="number"]')` on
 * connected.  Drag-distance controls how many pixels of horizontal mouse
 * movement it takes to traverse the full [min, max] range.
 *
 * Dispatches `input` and `change` events on the wrapped input so existing
 * lit-html `@input` / `@change` bindings work as expected.
 */
class NumberSlider extends HTMLElement {
  #input: HTMLInputElement | null = null;
  #dragging = false;
  #startX = 0;
  #startValue = 0;
  #dragDistance = DEFAULT_DRAG_DISTANCE;
  #min = 0;
  #max = 100;
  #step = 1;
  #range = 100;

  // bound handlers for add/remove
  #onMouseDown = (e: MouseEvent) => this.#start(e);
  #onMouseMove = (e: MouseEvent) => this.#move(e);
  #onMouseUp = () => this.#stop();

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  connectedCallback() {
    this.style.display = "inline-block";
    this.#input = this.querySelector("input[type='number']");
    if (!this.#input) return;

    const attr = this.getAttribute("drag-distance");
    this.#dragDistance = attr ? parseFloat(attr) : DEFAULT_DRAG_DISTANCE;

    this.#readBounds();
    this.#input.style.cursor = "ew-resize";
    this.#input.addEventListener("mousedown", this.#onMouseDown);
  }

  disconnectedCallback() {
    this.#input?.removeEventListener("mousedown", this.#onMouseDown);
    document.removeEventListener("mousemove", this.#onMouseMove);
    document.removeEventListener("mouseup", this.#onMouseUp);
  }

  // -------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------

  #readBounds() {
    if (!this.#input) return;
    this.#min = this.#input.min !== "" ? parseFloat(this.#input.min) : 0;
    this.#max = this.#input.max !== "" ? parseFloat(this.#input.max) : 100;
    this.#step = this.#input.step !== "" ? parseFloat(this.#input.step) : 1;
    this.#range = this.#max - this.#min;
  }

  #start(e: MouseEvent) {
    if (!this.#input) return;
    // Don't preventDefault here — a plain click should focus/edit normally.
    // Scrubbing only engages after the cursor moves past DRAG_THRESHOLD.
    this.#readBounds();

    this.#startX = e.clientX;
    this.#startValue = parseFloat(this.#input.value) || 0;

    document.addEventListener("mousemove", this.#onMouseMove);
    document.addEventListener("mouseup", this.#onMouseUp);
  }

  #move(e: MouseEvent) {
    if (!this.#input) return;

    if (!this.#dragging) {
      if (Math.abs(e.clientX - this.#startX) < DRAG_THRESHOLD) return;
      this.#dragging = true;
    }

    e.preventDefault(); // prevent text selection while scrubbing

    const pct = (e.clientX - this.#startX) / this.#dragDistance;
    let v = this.#startValue + pct * this.#range;

    v = Math.max(this.#min, Math.min(this.#max, v));

    if (this.#step !== 0) {
      const steps = Math.round((v - this.#min) / this.#step);
      v = this.#min + steps * this.#step;
      // clamp floating-point noise
      const decimals = this.#decimals(this.#step);
      if (decimals > 0) v = parseFloat(v.toFixed(decimals));
    }

    this.#input.value = String(v);
    this.#input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  #stop() {
    document.removeEventListener("mousemove", this.#onMouseMove);
    document.removeEventListener("mouseup", this.#onMouseUp);

    if (this.#dragging) {
      this.#dragging = false;
      this.#input?.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  #decimals(n: number): number {
    const s = String(n);
    const dot = s.indexOf(".");
    if (dot === -1) return 0;
    return s.length - dot - 1;
  }
}

customElements.define("number-slider", NumberSlider);
