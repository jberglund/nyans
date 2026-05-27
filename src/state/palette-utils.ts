import type { State } from "./types";

/** Find the next available palette ID: "p1", "p2", … */
export function nextPaletteId(state: State): string {
  let n = 1;
  while (state.palettes[`p${n}`]) n++;
  return `p${n}`;
}
