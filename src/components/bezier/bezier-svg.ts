import { svg, nothing } from "lit-html";
import { type BezierControls, type DragTarget } from "../../state/types";
import { bezierYAtX } from "../../state/bezier";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  steps: string[];
  startValue: number;
  endValue: number;
  dragging: DragTarget | null;
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
  onPointerDown: (e: PointerEvent, which: DragTarget) => void;
  onKeyDown: (e: KeyboardEvent, which: DragTarget) => void;
}

interface HandleSpec {
  which: DragTarget;
  cx: number;
  cy: number;
  active: boolean;
  isAnchor: boolean;
  label: string;
  valueNow: number;
  valueText: string;
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

export function renderBezierSvg(props: BezierSvgProps) {
  const { height: h, plotWidth: pw, plotHeight: ph, controls: c, steps, dragging } = props;

  const toX = (n: number) => n * pw;
  const toY = (n: number) => n * ph;
  const num = steps.length;

  // Smooth curve polyline — sampled points from t=0 to t=1
  const SAMPLES = 100;
  const curvePoints: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const cx = toX(t);
    const cy = toY(bezierYAtX(t, c));
    curvePoints.push(`${cx.toFixed(3)},${cy.toFixed(3)}`);
  }
  const curvePath = svg`
    <polyline
      points="${curvePoints.join(" ")}"
      class="bezier-editor__step-path"
    />
  `;

  // Step diamonds — one per palette stop, centered in equal columns
  const halfStep = STEP_DIAMOND_SIZE / 2;
  const stepDiamonds = steps.map((_step, i) => {
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
    const x = ((i + 1) / num) * pw;
    return svg`
      <line x1="${x}" y1="0" x2="${x}" y2="${ph}" class="bezier-editor__grid-line" />
    `;
  });

  // Horizontal grid lines — evenly spaced across the plot height
  const hGrid = Array.from({ length: H_GRID_LINES }, (_, i) => {
    const y = ((i + 1) / (H_GRID_LINES + 1)) * ph;
    return svg`
      <line x1="0" y1="${y}" x2="${pw}" y2="${y}" class="bezier-editor__grid-line" />
    `;
  });

  // Control point positions
  const p0 = { x: 0, y: toY(c.p0y) };
  const p1 = { x: toX(c.p1x), y: toY(c.p1y) };
  const p2 = { x: toX(c.p2x), y: toY(c.p2y) };
  const p3 = { x: pw, y: toY(c.p3y) };

  // Handle specs — data-driven so all four handles are visible at a glance
  const handles: HandleSpec[] = [
    {
      which: "p0",
      cx: p0.x,
      cy: p0.y,
      active: dragging === "p0",
      isAnchor: true,
      label: "Start lightness",
      valueNow: props.startValue,
      valueText: props.startValue.toFixed(3),
    },
    {
      which: "p1",
      cx: p1.x,
      cy: p1.y,
      active: dragging === "p1",
      isAnchor: false,
      label: "Control point 1",
      valueNow: c.p1y,
      valueText: `x: ${c.p1x.toFixed(2)}, y: ${c.p1y.toFixed(2)}`,
    },
    {
      which: "p2",
      cx: p2.x,
      cy: p2.y,
      active: dragging === "p2",
      isAnchor: false,
      label: "Control point 2",
      valueNow: c.p2y,
      valueText: `x: ${c.p2x.toFixed(2)}, y: ${c.p2y.toFixed(2)}`,
    },
    {
      which: "p3",
      cx: p3.x,
      cy: p3.y,
      active: dragging === "p3",
      isAnchor: true,
      label: "End lightness",
      valueNow: props.endValue,
      valueText: props.endValue.toFixed(3),
    },
  ];

  return svg`
    <svg
      width="100%" height="${h}"
      class="bezier-editor__svg"
      @pointermove=${props.onMove}
      @pointerup=${props.onUp}
      @pointerleave=${props.onUp}
    >
      <!-- Plot background -->
      <rect x="0" y="0" width="${pw}" height="${ph}" class="bezier-editor__plot-bg" rx="6" />

      <g class="bezier-editor__grid">
        ${vGrid}
        ${hGrid}
      </g>

      <g class="bezier-editor__steps">
        ${curvePath}
        ${stepDiamonds}
      </g>

      <g class="bezier-editor__axes">
        <line x1="0" y1="${ph}" x2="${pw}" y2="${ph}" class="bezier-editor__axis" />
        <line x1="0" y1="${ph}" x2="0" y2="0" class="bezier-editor__axis" />
      </g>

      <g class="bezier-editor__curve">
        <line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" class="bezier-editor__control-line" />
        <line x1="${p3.x}" y1="${p3.y}" x2="${p2.x}" y2="${p2.y}" class="bezier-editor__control-line" />
        ${renderAnchorLabel(p0.x, p0.y, props.startValue, "left")}
        ${handles.map((h) => renderHandle(h, props.onPointerDown, props.onKeyDown))}
        ${renderAnchorLabel(p3.x, p3.y, props.endValue, "right")}
      </g>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Handle rendering
// ---------------------------------------------------------------------------

type OnPointerDown = (e: PointerEvent, which: DragTarget) => void;
type OnKeyDown = (e: KeyboardEvent, which: DragTarget) => void;

/** Unified handle — anchors and control points differ only by data, not markup. */
function renderHandle(spec: HandleSpec, onPointerDown: OnPointerDown, onKeyDown: OnKeyDown) {
  const { which, cx, cy, isAnchor, label, valueNow, valueText } = spec;
  // JS-driven active classes kept as fallback — active state now handled by CSS :active
  // const activeMod = active ? " bezier-editor__handle--active" : "";
  // const dotActiveMod = active ? " bezier-editor__handle-dot--active" : "";
  const anchorMod = isAnchor ? " bezier-editor__handle--anchor" : "";
  const half = HANDLE_SIZE / 2;
  const halfDot = HANDLE_DOT_SIZE / 2;

  return svg`
    <g
      class="bezier-editor__handle-group"
      transform="rotate(45 ${cx} ${cy})"
      tabindex="0"
      role="slider"
      aria-label="${label}"
      aria-valuenow="${valueNow}"
      aria-valuemin="0"
      aria-valuemax="1"
      aria-valuetext="${valueText}"
      aria-orientation=${isAnchor ? "vertical" : nothing}
      @keydown=${(e: KeyboardEvent) => onKeyDown(e, which)}
      @pointerdown=${(e: PointerEvent) => onPointerDown(e, which)}
    >
      <rect
        x="${cx - half}" y="${cy - half}"
        width="${HANDLE_SIZE}" height="${HANDLE_SIZE}"
        rx="2.5" ry="2.5"
        class="bezier-editor__handle${anchorMod}"
      />
      <rect
        x="${cx - halfDot}" y="${cy - halfDot}"
        width="${HANDLE_DOT_SIZE}" height="${HANDLE_DOT_SIZE}"
        rx="1" ry="1"
        class="bezier-editor__handle-dot"
      />
    </g>
  `;
}

/** Value label placed beside an anchor handle. */
function renderAnchorLabel(cx: number, cy: number, value: number, side: "left" | "right") {
  const offset = HANDLE_SIZE / 2 + 10;
  // "right" = label sits to the right of the handle, text extends rightward.
  const x = side === "right" ? cx + offset : cx - offset;
  const anchor = side === "right" ? "start" : "end";
  return svg`
    <text
      x="${x}" y="${cy}"
      text-anchor="${anchor}"
      dominant-baseline="central"
      class="bezier-editor__anchor-label"
    >${value.toFixed(3)}</text>
  `;
}
