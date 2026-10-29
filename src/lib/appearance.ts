/**
 * Appearance (palette + mode) model. Pure functions only, so the logic is
 * unit-testable without a browser. The pre-paint script in theme-script.ts
 * mirrors parseAppearance/resolveMode; a test keeps the two in sync.
 */

export const APPEARANCE_STORAGE_KEY = "frame-appearance";

export const PALETTES = ["blue", "crimson"] as const;
export const MODES = ["light", "dark", "system"] as const;

export type Palette = (typeof PALETTES)[number];
export type ModePreference = (typeof MODES)[number];
export type ResolvedMode = "light" | "dark";

export interface Appearance {
  palette: Palette;
  mode: ModePreference;
}

export const DEFAULT_APPEARANCE: Appearance = { palette: "blue", mode: "dark" };

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

export function isModePreference(value: unknown): value is ModePreference {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Never throws: corrupt or partial storage falls back to defaults per field. Migrates 'gold' to 'blue'. */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return { ...DEFAULT_APPEARANCE };
  try {
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      let palette: Palette = DEFAULT_APPEARANCE.palette;
      if (record.palette === "crimson") {
        palette = "crimson";
      } else if (record.palette === "blue" || record.palette === "gold") {
        palette = "blue";
      }
      return {
        palette,
        mode: isModePreference(record.mode) ? record.mode : DEFAULT_APPEARANCE.mode,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_APPEARANCE };
}

export function serializeAppearance(appearance: Appearance): string {
  return JSON.stringify({ palette: appearance.palette, mode: appearance.mode });
}

export function resolveMode(mode: ModePreference, prefersDark: boolean): ResolvedMode {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export function readStoredAppearance(
  storage: Pick<Storage, "getItem"> | null | undefined,
): Appearance {
  try {
    return parseAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY));
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

/** Writes the DOM contract: data-palette, data-mode (resolved), data-mode-pref. */
export function applyAppearance(
  root: HTMLElement,
  appearance: Appearance,
  prefersDark: boolean,
): ResolvedMode {
  const resolved = resolveMode(appearance.mode, prefersDark);
  root.dataset.palette = appearance.palette;
  root.dataset.mode = resolved;
  root.dataset.modePref = appearance.mode;
  root.style.colorScheme = resolved;
  return resolved;
}
