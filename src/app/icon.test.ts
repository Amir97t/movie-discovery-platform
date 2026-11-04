import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Favicon Cinema Red (src/app/icon.svg)", () => {
  const iconPath = resolve(process.cwd(), "src/app/icon.svg");
  const svgContent = readFileSync(iconPath, "utf-8");

  it("exists and contains valid SVG structure", () => {
    expect(svgContent).toContain("<svg");
    expect(svgContent).toContain("</svg>");
    expect(svgContent).toContain('viewBox="0 0 32 32"');
  });

  it("uses the dark graphite cinema background (#111318)", () => {
    expect(svgContent.toLowerCase()).toContain("#111318");
    expect(svgContent.toLowerCase()).not.toContain("#f2b544");
    expect(svgContent.toLowerCase()).not.toContain("#17130a");
  });

  it("uses the Cinema Red brand accent (#E50914) for the aperture symbol", () => {
    expect(svgContent.toUpperCase()).toContain("#E50914");
  });
});
