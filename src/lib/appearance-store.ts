import {
  applyAppearance,
  isModePreference,
  isPalette,
  writeStoredAppearance,
  type Appearance,
} from "./appearance";

/**
 * The <html> data attributes are the single source of truth for the current
 * appearance (the pre-paint script sets them). This tiny external store lets
 * React read them via useSyncExternalStore without duplicating state.
 */
const listeners = new Set<() => void>();

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot is a primitive string so React can compare it cheaply. */
export function getAppearanceSnapshot(): string {
  const root = document.documentElement;
  return `${root.dataset.palette ?? ""}|${root.dataset.modePref ?? ""}`;
}

export function getServerAppearanceSnapshot(): string {
  return "gold|system";
}

export function parseSnapshot(snapshot: string): Appearance {
  const [palette, mode] = snapshot.split("|");
  return {
    palette: isPalette(palette) ? palette : "gold",
    mode: isModePreference(mode) ? mode : "system",
  };
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function setAppearance(next: Appearance): void {
  try {
    writeStoredAppearance(window.localStorage, next);
  } catch {
    // storage blocked: appearance still applies for this page view
  }
  applyAppearance(document.documentElement, next, prefersDark());
  listeners.forEach((listener) => listener());
}

/** Re-resolves "system" mode when the OS preference changes. */
export function followSystemMode(appearance: Appearance): () => void {
  if (appearance.mode !== "system") return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => applyAppearance(document.documentElement, appearance, query.matches);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
