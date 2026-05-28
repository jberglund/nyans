import { html, render } from "lit-html";

/**
 * Inline info trigger. Click the `?` icon to reveal slotted content in a popover.
 *
 * Popover API handles light-dismiss and ESC for free.
 * CSS anchor positioning keeps the popover near the trigger.
 *
 * Usage:
 *   <tool-tip>
 *     <p>Helpful context about this setting.</p>
 *   </tool-tip>
 */
class ToolTip extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    render(
      html`
        <style>
          :host {
            display: inline-flex;
            vertical-align: middle;
          }

          .trigger {
            appearance: none;
            border: none;
            background: none;
            padding: 0;
            font: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.2em;
            height: 1.2em;
            border-radius: 50%;
            border: 1.5px solid currentColor;
            color: var(--text-low);
            font-size: 0.7em;
            font-weight: 700;
            line-height: 1;
          }

          .trigger:hover,
          .trigger:focus-visible {
            color: var(--text-mid);
            background: var(--surface-overlay);
          }

          .popover {
            border: 1px solid var(--border-default);
            border-radius: 6px;
            padding: 0.5rem 0.75rem;
            max-width: 280px;
            width: 100%;
            font-size: 0.8rem;
            font-weight: var(--font-weight-regular);
            line-height: 1.5;
            color: var(--text-high);
            background: var(--surface-default);
            box-shadow: var(--shadow-default);
            margin: 0;
            /* anchor positioning — progressive enhancement */
            top: anchor(bottom);
            left: anchor(center);
            position-area: right bottom;
            position-try-options: flip-block;
          }

          ::slotted(*) {
            margin: 0;
          }
        </style>

        <button
          id="tt-trigger"
          class="button trigger"
          popovertarget="tip"
          popovertargetaction="toggle"
          aria-label="More info"
        >
          ?
        </button>

        <div id="tip" class="popover" popover role="tooltip" anchor="tt-trigger">
          <slot></slot>
        </div>
      `,
      this.shadowRoot!,
    );
  }
}

customElements.define("tool-tip", ToolTip);
