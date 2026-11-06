import { ImageResponse } from "next/og";

export const alt = "FRAME — Movie Discovery Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111318",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 350,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(229,9,20,0.2) 0%, rgba(17,19,24,0) 70%)",
          }}
        />

        {/* Brand Reel / Frame Motif */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            border: "6px solid #E50914",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: "#E50914",
            }}
          />
        </div>

        {/* Brand Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
            marginBottom: 16,
            display: "flex",
          }}
        >
          FRAME
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: "#A1A1AA",
            maxWidth: 750,
            textAlign: "center",
            display: "flex",
          }}
        >
          Bilingual Movie Discovery &amp; Personal Library Platform
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
