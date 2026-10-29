import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function themeTokens(palette: string, mode: string): Record<string, string> {
  const pattern = new RegExp(
    `\\[data-palette="${palette}"\\]\\[data-mode="${mode}"\\]\\s*\\{([^}]*)\\}`,
  );
  const block = pattern.exec(css)?.[1];
  if (!block) throw new Error(`theme block missing: ${palette}-${mode}`);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]!] = match[2]!;
  }
  return tokens;
}

const THEMES = [
  ["blue", "dark"],
  ["blue", "light"],
  ["crimson", "dark"],
  ["crimson", "light"],
] as const;

describe.each(THEMES)("%s-%s tokens", (palette, mode) => {
  const t = themeTokens(palette, mode);
  const surfaces = ["background", "surface", "surface-raised"] as const;

  it("body and muted text reach 4.5:1 on every surface", () => {
    for (const surface of surfaces) {
      expect(contrast(t["text-primary"]!, t[surface]!), `text-primary on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["text-muted"]!, t[surface]!), `text-muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accent works as text on every surface and carries its foreground at 4.5:1", () => {
    for (const surface of surfaces) {
      expect(contrast(t["accent"]!, t[surface]!), `accent on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t["accent-foreground"]!, t["accent"]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["accent-foreground"]!, t["accent-hover"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("semantic text colors reach 4.5:1 on background and surface", () => {
    for (const name of ["success", "warning", "danger"]) {
      for (const surface of ["background", "surface"]) {
        expect(contrast(t[name]!, t[surface]!), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("control outlines and focus ring reach 3:1 (non-text contrast)", () => {
    for (const surface of ["background", "surface"]) {
      expect(contrast(t["border-strong"]!, t[surface]!), `border-strong on ${surface}`).toBeGreaterThanOrEqual(3);
      expect(contrast(t["focus-ring"]!, t[surface]!), `focus-ring on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(t["favorite"]!, t["surface"]!)).toBeGreaterThanOrEqual(3);
  });
});
