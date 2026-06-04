import { html } from "lit-html";

// ---------------------------------------------------------------------------
// palette-toolbar
// ---------------------------------------------------------------------------

export const maxChromaTip = html`
  <div class="typeset">
    <p><strong>Max chroma</strong> sets the ceiling for color intensity across every swatch.</p>
    <p><em>Lower values</em> stay safer within your display's gamut.</p>
    <dl>
      <dt>0.4</dt>
      <dd>vivid, may clip on sRGB screens</dd>
      <dt>0.2</dt>
      <dd>conservative, always safe</dd>
    </dl>
  </div>
`;

export const ceilingTip = html`
  <div class="typeset">
    <p>
      The <strong>color space</strong> used to calculate the gamut warning zone on chroma sliders.
    </p>
    <dl>
      <dt>sRGB</dt>
      <dd>the web standard. Safest choice.</dd>
      <dt>P3</dt>
      <dd>wider gamut. Most modern Apple/OLED screens.</dd>
      <dt>Rec.2020</dt>
      <dd>widest. Future-proof, but few displays cover it.</dd>
    </dl>
    <p>A wider gamut lets you push chroma higher before hitting the danger zone.</p>
  </div>
`;

export const spreadTip = html`
  <div class="typeset">
    <p>How strongly linked edits ripple outward to neighboring steps.</p>
    <dl>
      <dt>0.1</dt>
      <dd>barely touches the next step over</dd>
      <dt>0.9</dt>
      <dd>spreads across nearly the whole palette</dd>
    </dl>
    <p>Only active when holding <kbd>Shift</kbd> while dragging.</p>
  </div>
`;

export const chromaSmoothTip = html`
  <div class="typeset">
    <p>
      Smooths the chroma curve so neighboring steps don't jump sharply. The raw gamut ceiling has
      natural bumps — higher values iron those out.
    </p>
    <dl>
      <dt>0</dt>
      <dd>off — hugs the gamut ceiling exactly</dd>
      <dt>0.5</dt>
      <dd>light blur — softens local jaggies</dd>
      <dt>1</dt>
      <dd>heavy blur — gentle, even sweep</dd>
    </dl>
    <p>Applies when the origin color or lightness curve changes.</p>
  </div>
`;

// ---------------------------------------------------------------------------
// lightness-editor
// ---------------------------------------------------------------------------

export const presetTip = html`
  <div class="typeset">
    <p>
      Jump-start your curve with a preset shape. You can still tweak handles and endpoints after.
    </p>
    <dl>
      <dt>Balanced</dt>
      <dd>gentle contrast, most natural</dd>
      <dt>Linear</dt>
      <dd>even steps from light to dark</dd>
      <dt>Bright</dt>
      <dd>biased toward light end</dd>
      <dt>Midtone</dt>
      <dd>narrow range, low contrast</dd>
    </dl>
  </div>
`;

export const startLightnessTip = html`
  <div class="typeset">
    <p>Lightness at step <strong>0</strong> (the lightest swatch).</p>
    <p>0 = pure black · 1 = pure white</p>
  </div>
`;

export const endLightnessTip = html`
  <div class="typeset">
    <p>Lightness at step <strong>950</strong> (the darkest swatch).</p>
    <p>0 = pure black · 1 = pure white</p>
  </div>
`;
