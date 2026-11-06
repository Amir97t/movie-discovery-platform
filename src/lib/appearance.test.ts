import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  parseAppearance,
  readStoredAppearance,
  resolveMode,
  serializeAppearance,
  writeStoredAppearance,
} from "./appearance";
import { THEME_INIT_SCRIPT } from "./theme-script";

describe("parseAppearance", () => {
  it("falls back to defaults for empty, corrupt or wrong-typed storage", () => {
    for (const raw of [null, undefined, "", "not json", "null", "42", "[]"]) {
      expect(parseAppearance(raw)).toEqual(DEFAULT_APPEARANCE);
    }
  });

  it("extracts and preserves valid modes and defaults invalid ones", () => {
    expect(parseAppearance('{"mode":"light"}')).toEqual({ mode: "light" });
    expect(parseAppearance('{"mode":"dark"}')).toEqual({ mode: "dark" });
    expect(parseAppearance('{"mode":"system"}')).toEqual({ mode: "system" });
    expect(parseAppearance('{"mode":"banana"}')).toEqual({ mode: "dark" });
  });

  it("migrates legacy records with palette keys while preserving their saved mode", () => {
    expect(parseAppearance('{"palette":"blue","mode":"light"}')).toEqual({ mode: "light" });
    expect(parseAppearance('{"palette":"crimson","mode":"dark"}')).toEqual({ mode: "dark" });
    expect(parseAppearance('{"palette":"gold","mode":"system"}')).toEqual({ mode: "system" });
    expect(parseAppearance('{"palette":"gold"}')).toEqual({ mode: "dark" });
  });

  it("round-trips through serialize", () => {
    const darkVal = { mode: "dark" } as const;
    expect(parseAppearance(serializeAppearance(darkVal))).toEqual(darkVal);
    const lightVal = { mode: "light" } as const;
    expect(parseAppearance(serializeAppearance(lightVal))).toEqual(lightVal);
  });
});

describe("resolveMode", () => {
  it("resolves system from the OS preference and leaves explicit modes alone", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});

describe("storage helpers", () => {
  it("never throws when storage throws", () => {
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(readStoredAppearance(broken)).toEqual(DEFAULT_APPEARANCE);
    expect(writeStoredAppearance(broken, DEFAULT_APPEARANCE)).toBe(false);
    expect(writeStoredAppearance(null, DEFAULT_APPEARANCE)).toBe(false);
  });

  it("migrates legacy palette records in storage to canonical mode-only JSON", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => '{"palette":"blue","mode":"light"}',
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    const appearance = readStoredAppearance(storage);
    expect(appearance).toEqual({ mode: "light" });
    expect(saved).toBe(JSON.stringify({ mode: "light" }));
  });

  it("safely canonicalizes primitive or malformed storage to valid defaults", () => {
    const invalidCases = ["42", "true", '"hello"', "[1, 2]", "bad json", '{"mode":"invalid"}'];
    for (const raw of invalidCases) {
      let saved: string | null = null;
      const storage = {
        getItem: () => raw,
        setItem: (_k: string, v: string) => {
          saved = v;
        },
      };
      const appearance = readStoredAppearance(storage);
      expect(appearance).toEqual(DEFAULT_APPEARANCE);
      expect(saved).toBe(JSON.stringify({ mode: "dark" }));
    }
  });

  it("does not rewrite canonical storage or uninitialized null storage", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => JSON.stringify({ mode: "light" }),
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    expect(readStoredAppearance(storage)).toEqual({ mode: "light" });
    expect(saved).toBeNull();

    let nullSaved: string | null = null;
    const nullStorage = {
      getItem: () => null,
      setItem: (_k: string, v: string) => {
        nullSaved = v;
      },
    };
    expect(readStoredAppearance(nullStorage)).toEqual(DEFAULT_APPEARANCE);
    expect(nullSaved).toBeNull();
  });
});

describe("applyAppearance", () => {
  it("writes the data-mode contract and removes any legacy data-palette", () => {
    const root = document.createElement("html");
    root.dataset.palette = "blue";
    const resolved = applyAppearance(root, { mode: "system" }, true);
    expect(resolved).toBe("dark");
    expect(root.dataset.mode).toBe("dark");
    expect(root.dataset.modePref).toBe("system");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.dataset.palette).toBeUndefined();
  });

  it("synchronizes meta[name=theme-color] with active resolved mode", () => {
    const root = document.createElement("html");
    const metaLight = document.createElement("meta");
    metaLight.setAttribute("name", "theme-color");
    metaLight.setAttribute("media", "(prefers-color-scheme: light)");
    metaLight.setAttribute("content", "#F3EFEB");
    const metaDark = document.createElement("meta");
    metaDark.setAttribute("name", "theme-color");
    metaDark.setAttribute("media", "(prefers-color-scheme: dark)");
    metaDark.setAttribute("content", "#111318");
    document.head.appendChild(metaLight);
    document.head.appendChild(metaDark);

    // Explicit manual dark mode: both meta tags should be dark (#111318)
    applyAppearance(root, { mode: "dark" }, false);
    expect(metaLight.getAttribute("content")).toBe("#111318");
    expect(metaDark.getAttribute("content")).toBe("#111318");

    // Explicit manual light mode: both meta tags should be light (#F3EFEB)
    applyAppearance(root, { mode: "light" }, true);
    expect(metaLight.getAttribute("content")).toBe("#F3EFEB");
    expect(metaDark.getAttribute("content")).toBe("#F3EFEB");

    // System mode: restores media-specific colors
    applyAppearance(root, { mode: "system" }, true);
    expect(metaLight.getAttribute("content")).toBe("#F3EFEB");
    expect(metaDark.getAttribute("content")).toBe("#111318");

    metaLight.remove();
    metaDark.remove();
  });
});

describe("pre-paint script parity", () => {
  function runScript(stored: string | null, prefersDark: boolean, onSetItem?: (val: string) => void) {
    const root = document.createElement("html");
    root.dataset.palette = "blue";
    const fakeDocument = { documentElement: root };
    const fakeStorage = {
      getItem: (key: string) => (key === APPEARANCE_STORAGE_KEY ? stored : null),
      setItem: (_k: string, v: string) => {
        onSetItem?.(v);
      },
    };
    const fakeWindow = { matchMedia: () => ({ matches: prefersDark }) };
    new Function("document", "localStorage", "window", THEME_INIT_SCRIPT)(
      fakeDocument,
      fakeStorage,
      fakeWindow,
    );
    return { mode: root.dataset.mode, pref: root.dataset.modePref, palette: root.dataset.palette };
  }

  const cases = [
    null,
    "garbage",
    "42",
    "true",
    '"hello"',
    "[1, 2]",
    '{"mode":"light"}',
    '{"mode":"dark"}',
    '{"mode":"system"}',
    '{"palette":"crimson","mode":"light"}',
    '{"palette":"blue","mode":"dark"}',
    '{"palette":"gold","mode":"system"}',
  ];

  it("produces the same result as applyAppearance for stored and OS inputs without throwing", () => {
    for (const stored of cases) {
      for (const prefersDark of [true, false]) {
        const expected = parseAppearance(stored);
        const root = document.createElement("html");
        const resolved = applyAppearance(root, expected, prefersDark);
        expect(runScript(stored, prefersDark)).toEqual({
          mode: resolved,
          pref: expected.mode,
          palette: undefined,
        });
      }
    }
  });

  it("migrates legacy records in storage to mode-only during pre-paint script execution", () => {
    let saved: string | null = null;
    const result = runScript('{"palette":"gold","mode":"light"}', true, (val) => {
      saved = val;
    });
    expect(result.mode).toBe("light");
    expect(result.pref).toBe("light");
    expect(result.palette).toBeUndefined();
    expect(saved).toBe(JSON.stringify({ mode: "light" }));
  });

  it("safely handles valid JSON primitives and corrupt storage during pre-paint script", () => {
    const invalidInputs = ["42", "true", '"hello"', "[1, 2]", "not json", '{"mode":"banana"}'];
    for (const raw of invalidInputs) {
      let saved: string | null = null;
      const result = runScript(raw, true, (val) => {
        saved = val;
      });
      expect(result.mode).toBe("dark");
      expect(result.pref).toBe("dark");
      expect(result.palette).toBeUndefined();
      expect(saved).toBe(JSON.stringify({ mode: "dark" }));
    }
  });

  it("does not overwrite canonical storage or null storage during pre-paint script", () => {
    let saved: string | null = null;
    const result = runScript(JSON.stringify({ mode: "light" }), true, (val) => {
      saved = val;
    });
    expect(result.mode).toBe("light");
    expect(result.pref).toBe("light");
    expect(saved).toBeNull();

    let nullSaved: string | null = null;
    const nullResult = runScript(null, true, (val) => {
      nullSaved = val;
    });
    expect(nullResult.mode).toBe("dark");
    expect(nullResult.pref).toBe("dark");
    expect(nullSaved).toBeNull();
  });
});
