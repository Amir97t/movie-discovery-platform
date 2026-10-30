/**
 * Appearance (mode) model. Pure functions only, unit-testable without a browser.
 * The pre-paint script in theme-script.ts mirrors parseAppearance/resolveMode;
 * tests keep the two in sync.
 */

export const APPEARANCE_STORAGE_KEY = "frame-appearance";

export const MODES = ["light", "dark", "system"] as const;

export type ModePreference = (typeof MODES)[number];
export type ResolvedMode = "light" | "dark";

export interface Appearance {
  mode: ModePreference;
}

export const DEFAULT_APPEARANCE: Appearance = { mode: "dark" };

export function isModePreference(value: unknown): value is ModePreference {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/**
 * Safely parses stored JSON. Backward-compatible with legacy records that contained
 * palette keys (e.g. { palette: "blue", mode: "light" }), extracting and preserving
 * the mode preference while defaulting to "dark".
 */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return { ...DEFAULT_APPEARANCE };
  try {
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      return {
        mode: isModePreference(record.mode) ? record.mode : DEFAULT_APPEARANCE.mode,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_APPEARANCE };
}

export function serializeAppearance(appearance: Appearance): string {
  return JSON.stringify({ mode: appearance.mode });
}

export function resolveMode(mode: ModePreference, prefersDark: boolean): ResolvedMode {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/**
 * Reads stored appearance from storage. If the stored record contains legacy fields
 * (such as "palette") or is not canonical mode-only JSON, it safely migrates storage.
 */
export function readStoredAppearance(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
): Appearance {
  try {
    const raw = storage?.getItem(APPEARANCE_STORAGE_KEY);
    const parsed = parseAppearance(raw);
    if (raw && storage && "setItem" in storage && typeof storage.setItem === "function") {
      try {
        const data: unknown = JSON.parse(raw);
        if (data && typeof data === "object") {
          const record = data as Record<string, unknown>;
          if ("palette" in record || Object.keys(record).length !== 1 || record.mode !== parsed.mode) {
            writeStoredAppearance(storage, parsed);
          }
        }
      } catch {
        // ignore JSON errors
      }
    }
    return parsed;
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** Returns false when storage is unavailable (private mode, quota, blocked). */
export function writeStoredAppearance(
  storage: Pick<Storage, "setItem"> | null | undefined,
  appearance: Appearance,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearance(appearance));
    return true;
  } catch {
    return false;
  }
}

/** Writes the DOM contract: data-mode (resolved), data-mode-pref. */
export function applyAppearance(
  root: HTMLElement,
  appearance: Appearance,
  prefersDark: boolean,
): ResolvedMode {
  const resolved = resolveMode(appearance.mode, prefersDark);
  root.dataset.mode = resolved;
  root.dataset.modePref = appearance.mode;
  root.style.colorScheme = resolved;
  delete root.dataset.palette;
  return resolved;
}
