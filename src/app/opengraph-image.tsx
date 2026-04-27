import { ImageResponse } from "next/og";

export const alt = "Learning et al. — The digest that thinks.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const spaceGrotesk = await fetch(
    "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gozuM7Ku7sAg93QSkFtoMM3.woff"
  ).then((r) => r.arrayBuffer()).catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          border: "6px solid #1a1a1a",
        }}
      >
        {/* Blob — top left, green */}
        <div style={{
          position: "absolute", top: -80, left: -80,
          width: 480, height: 480,
          background: "#6EE9A8", borderRadius: "50%",
          filter: "blur(90px)", opacity: 0.45, display: "flex",
        }} />
        {/* Blob — bottom right, yellow */}
        <div style={{
          position: "absolute", bottom: -100, right: -60,
          width: 440, height: 440,
          background: "#D4F04A", borderRadius: "50%",
          filter: "blur(90px)", opacity: 0.45, display: "flex",
        }} />
        {/* Blob — top right, pink */}
        <div style={{
          position: "absolute", top: -40, right: 200,
          width: 300, height: 300,
          background: "#FF85A8", borderRadius: "50%",
          filter: "blur(80px)", opacity: 0.35, display: "flex",
        }} />
        {/* Blob — bottom left, purple */}
        <div style={{
          position: "absolute", bottom: 60, left: 300,
          width: 260, height: 260,
          background: "#A878E8", borderRadius: "50%",
          filter: "blur(80px)", opacity: 0.30, display: "flex",
        }} />

        {/* Header bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 52px",
          height: 72,
          borderBottom: "4px solid #1a1a1a",
          position: "relative",
          zIndex: 2,
          background: "rgba(255,255,255,0.85)",
        }}>
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#1a1a1a",
            fontFamily: spaceGrotesk ? "SpaceGrotesk" : "sans-serif",
            display: "flex",
          }}>
            LEARNING ET AL.
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#888",
            fontFamily: "monospace",
            display: "flex",
          }}>
            learningetal.com
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "52px 60px 52px",
          position: "relative",
          zIndex: 2,
          gap: 28,
        }}>
          {/* Label */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#1a1a1a",
              fontFamily: "monospace",
              display: "flex",
              padding: "5px 12px",
              border: "2px solid #1a1a1a",
              background: "white",
            }}>
              Daily Digest
            </div>
          </div>

          {/* Big tagline */}
          <div style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#1a1a1a",
            maxWidth: 960,
            fontFamily: spaceGrotesk ? "SpaceGrotesk" : "sans-serif",
            display: "flex",
            flexWrap: "wrap",
          }}>
            One question a day. Papers as tools to think with.
          </div>

          {/* Sub line */}
          <div style={{
            fontSize: 26,
            color: "#555",
            lineHeight: 1.4,
            fontFamily: "sans-serif",
            display: "flex",
          }}>
            AI-curated research synthesis, personalized to your curiosity.
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "0 52px",
          height: 52,
          borderTop: "3px solid #1a1a1a",
          background: "#1a1a1a",
          position: "relative",
          zIndex: 2,
          gap: 24,
        }}>
          {["Research Synthesis", "Paper Discovery", "Daily Digest", "Ask Questions"].map((tag) => (
            <div key={tag} style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#aaa",
              fontFamily: "monospace",
              display: "flex",
            }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: spaceGrotesk ? [{
        name: "SpaceGrotesk",
        data: spaceGrotesk,
        weight: 700,
      }] : [],
    }
  );
}
