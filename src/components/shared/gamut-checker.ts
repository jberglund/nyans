/**
 * A visual badge overlay on palette swatches indicating display gamut.
 *
 * CSS uses the `color-gamut` attribute to show a warning stripe for
 * colors that exceed sRGB or P3. Gamut classification is computed in
 * derive.ts — this element is a pure presentation hook.
 *
 * @attr color-gamut - "srgb" | "p3" | "rec2020" | "rec2020+"
 *
 * @example
 * <gamut-checker color-gamut="p3"></gamut-checker>
 */
class GamutChecker extends HTMLElement {}

customElements.define("gamut-checker", GamutChecker);
