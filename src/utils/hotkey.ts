/**
 * Global hotkey module.
 *
 * Scans the DOM for elements with `hotkey-key` attributes and clicks them when
 * the matching key combination is pressed.
 *
 * @example
 * import { initHotkeys } from "./hotkey";
 *
 * // Start listening for hotkeys
 * const cleanup = initHotkeys();
 *
 * // Limit to a subtree of the DOM
 * const cleanup = initHotkeys({ root: document.getElementById("app")! });
 *
 * // Remove listeners when done
 * cleanup();
 *
 * @html
 * <!-- Will only trigger when 'g' is pressed WITH Shift+Ctrl+Meta -->
 * <button hotkey-key="g" hotkey-modifier-shift hotkey-modifier-ctrl hotkey-modifier-meta></button>
 *
 * <!-- Will only trigger when 'a' is pressed AND Ctrl is NOT pressed -->
 * <button hotkey-key="a" hotkey-modifier-ctrl="false">No Control</button>
 *
 * <!-- Will only trigger when ArrowRight is pressed with no modifiers -->
 * <a href="/next" hotkey-key="arrowright">Next</a>
 */

const HOTKEY_ATTRIBUTE = "hotkey-key" as const;
const HOTKEY_MODIFIER_PREFIX = "hotkey-modifier" as const;
const HOTKEY_RESTORE_FOCUS = "hotkey-restore-focus" as const;
const MODIFIER_KEYS = ["shift", "ctrl", "alt", "meta"] as const;
// Only skip text-entry inputs — not checkboxes, radios, buttons, etc.
const TEXT_INPUT_TYPES = new Set(["text", "email", "number", "password", "search", "tel", "url"]);

let keyMap: Map<string, HTMLElement[]> = new Map();
let boundHandler: ((event: KeyboardEvent) => void) | null = null;
let observer: MutationObserver | null = null;

interface HotkeyOptions {
  /** Root element to scan for hotkey elements. Defaults to `document`. */
  root?: HTMLElement;
}

function getModifiers(element: HTMLElement): Record<string, boolean> {
  const modifiers: Record<string, boolean> = {};

  for (const modifier of MODIFIER_KEYS) {
    const attrName = `${HOTKEY_MODIFIER_PREFIX}-${modifier}`;

    if (element.hasAttribute(attrName)) {
      const attrValue = element.getAttribute(attrName);
      modifiers[modifier] = attrValue !== "false";
    } else {
      modifiers[modifier] = false;
    }
  }

  return modifiers;
}

function buildKeyMap(root: HTMLElement | Document): void {
  keyMap.clear();

  const elements = root.querySelectorAll<HTMLElement>(`[${HOTKEY_ATTRIBUTE}]`);

  for (const element of elements) {
    const key = element.getAttribute(HOTKEY_ATTRIBUTE)?.toLowerCase();
    if (!key) continue;

    const existing = keyMap.get(key);
    if (existing) {
      existing.push(element);
    } else {
      keyMap.set(key, [element]);
    }
  }
}

function isEditableContext(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "textarea" || tagName === "select") return true;

  if (tagName === "input") {
    const type = (target as HTMLInputElement).type.toLowerCase();
    // An input with no type is "text" by default
    return !type || TEXT_INPUT_TYPES.has(type);
  }

  return false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (isEditableContext(event.target)) return;

  const pressedKey = event.key.toLowerCase();
  const elements = keyMap.get(pressedKey);

  if (!elements || elements.length === 0) return;

  for (const element of elements) {
    const requiredModifiers = getModifiers(element);

    let matches = true;
    for (const modifier of MODIFIER_KEYS) {
      const attrName = `${HOTKEY_MODIFIER_PREFIX}-${modifier}`;
      if (element.hasAttribute(attrName)) {
        const isPressed = event[`${modifier}Key` as keyof KeyboardEvent] as boolean;
        if (requiredModifiers[modifier] !== isPressed) {
          matches = false;
          break;
        }
      }
    }

    if (matches) {
      const restoreFocus = element.hasAttribute(HOTKEY_RESTORE_FOCUS);
      const activeEl = document.activeElement;

      element.click();
      event.preventDefault();

      if (restoreFocus && activeEl instanceof HTMLElement) {
        activeEl.focus();
      }
      return;
    }
  }
}

/**
 * Start listening for hotkey events.
 *
 * Returns a cleanup function that removes all listeners and disconnects the
 * DOM observer. Call it when you want to stop hotkey handling (e.g. on
 * teardown).
 */
export function initHotkeys(opts: HotkeyOptions = {}): () => void {
  const root = opts.root ?? document;

  buildKeyMap(root);

  boundHandler = handleKeydown;
  document.addEventListener("keydown", boundHandler);

  observer = new MutationObserver(() => buildKeyMap(root));
  observer.observe(root === document ? document.documentElement : root, {
    childList: true,
    subtree: true,
  });

  return () => {
    if (boundHandler) {
      document.removeEventListener("keydown", boundHandler);
      boundHandler = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    keyMap.clear();
  };
}
