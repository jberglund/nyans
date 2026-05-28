import { deriveSwatches } from "../state";
import type { State } from "../state/types";
import { type ExportOptions, resolvePaletteIds, paletteName } from "./types";

interface DTCGColorValue {
  colorSpace: "oklch";
  components: [number, number, number];
  alpha: number;
}

/**
 * Generate DTCG-format design tokens for one or all palettes.
 *
 * Output follows the W3C DTCG spec:
 * https://tr.designtokens.org/format/
 *
 * Output example:
 * ```json
 * {
 *   "p1": {
 *     "600": {
 *       "$type": "color",
 *       "$value": {
 *         "colorSpace": "oklch",
 *         "components": [0.6, 0.216, 269],
 *         "alpha": 1
 *       }
 *     }
 *   }
 * }
 * ```
 */
export function toDTCG(state: State, options: ExportOptions): string {
  const result: Record<string, Record<string, { $value: DTCGColorValue; $type: "color" }>> = {};

  for (const paletteId of resolvePaletteIds(state, options.paletteIds)) {
    const swatches = deriveSwatches(state, paletteId);
    const name = paletteName(paletteId, options);
    const key = options.prefix ? `${options.prefix}-${name}` : name;

    result[key] = {};
    for (const swatch of swatches) {
      result[key][swatch.step] = {
        $value: {
          colorSpace: "oklch",
          components: [swatch.l, swatch.c, swatch.h],
          alpha: 1,
        },
        $type: "color",
      };
    }
  }

  return JSON.stringify(result, null, 2) + "\n";
}
