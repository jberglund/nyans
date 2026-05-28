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

export const linkedEditingTip = html`
  <div class="typeset">
    <p>
      When <strong>on</strong>, adjusting a swatch's chroma nudges neighboring steps too. This
      creates smoother transitions instead of isolated jumps.
    </p>
    <p>Use <em>Spread</em> to control how far the ripple travels.</p>
  </div>
`;

export const spreadTip = html`
  <div class="typeset">
    <p>How far linked edits ripple outward.</p>
    <dl>
      <dt>0.1</dt>
      <dd>barely touches the next step over</dd>
      <dt>0.9</dt>
      <dd>spreads across nearly the whole palette</dd>
    </dl>
    <p>Only active when <em>Linked editing</em> is enabled.</p>
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
      <dt>S-curve</dt>
      <dd>gentle contrast, most natural</dd>
      <dt>Linear</dt>
      <dd>even steps from light to dark</dd>
      <dt>Bright / Dark</dt>
      <dd>biased toward one end</dd>
      <dt>Flat</dt>
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
