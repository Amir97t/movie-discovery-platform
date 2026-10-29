/**
 * Global SVG filter definition for Apple Liquid Glass refraction.
 *
 * Browsers supporting SVG backdrop filters (Chromium) can use this filter
 * for subtle edge optical refraction, while WebKit/Firefox and reduced-transparency
 * environments cleanly fall back to standard backdrop blur/saturation.
 */
export function LiquidGlassFilter() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute -left-full -top-full size-0 opacity-0"
    >
      <defs>
        <filter
          id="liquid-glass-refraction"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Subtle micro-displacement for light refraction along curved glass rim */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.05"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
