const STORAGE_KEY = "theme";
type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function getCurrentTheme(): Theme {
  return resolveTheme();
}

export function toggleTheme(): Theme {
  const next = resolveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  return next;
}

// Apply on load
applyTheme(resolveTheme());

// Respond to system preference changes (only when no explicit user choice)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    applyTheme(resolveTheme());
  }
});
