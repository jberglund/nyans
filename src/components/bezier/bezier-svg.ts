import { svg } from "lit-html";
import { STEPS, type BezierControls } from "../../state/types";
import { bezierYAtX } from "../../state/bezier";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAD = 0;
const HANDLE_SIZE = 12;
const HANDLE_DOT_SIZE = 4;
const STEP_DIAMOND_SIZE = 8;
const H_GRID_LINES = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BezierSvgProps {
  height: number;
  plotWidth: number;
  plotHeight: number;
  controls: BezierControls;
  dragging: "p0" | "p1" | "p2" | "p3" | null;
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
  onPointerDown: (e: PointerEvent, which: "p0" | "p1" | "p2" | "p3") => void;
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

export function renderBezierSvg(props: BezierSvgProps) {
  const { height: h, plotWidth: pw, plotHeight: ph, controls: c, dragging } = props;

  const toX = (n: number) => PAD + n * pw;
  const toY = (n: number) => PAD + n * ph;
  const num = STEPS.length;

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
      @pointermove=${props.onMove}
      @pointerup=${props.onUp}
      @pointerleave=${props.onUp}
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
        ${renderAnchorHandle(p0x, p0y, dragging === "p0", "p0", props.onPointerDown)}
        ${renderHandle(toX(c.p1x), toY(c.p1y), dragging === "p1", "p1", props.onPointerDown)}
        ${renderHandle(toX(c.p2x), toY(c.p2y), dragging === "p2", "p2", props.onPointerDown)}
        ${renderAnchorHandle(p3x, p3y, dragging === "p3", "p3", props.onPointerDown)}
      </g>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Handle rendering
// ---------------------------------------------------------------------------

type DragTarget = "p0" | "p1" | "p2" | "p3";
type OnPointerDown = (e: PointerEvent, which: DragTarget) => void;

/** Draggable diamond handle for P1 / P2. */
function renderHandle(
  cx: number,
  cy: number,
  active: boolean,
  which: "p1" | "p2",
  onPointerDown: OnPointerDown,
) {
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
        @pointerdown=${(e: PointerEvent) => onPointerDown(e, which)}
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
function renderAnchorHandle(
  cx: number,
  cy: number,
  active: boolean,
  which: "p0" | "p3",
  onPointerDown: OnPointerDown,
) {
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
        @pointerdown=${(e: PointerEvent) => onPointerDown(e, which)}
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
