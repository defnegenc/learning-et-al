import { ImageResponse } from "next/og";

export const alt = "Learning et al. — Your AI research companion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-100px",
            width: "420px",
            height: "420px",
            background: "#f9a8d4",
            borderRadius: "50%",
            filter: "blur(100px)",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-80px",
            width: "380px",
            height: "380px",
            background: "#86efac",
            borderRadius: "50%",
            filter: "blur(100px)",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "200px",
            left: "520px",
            width: "260px",
            height: "260px",
            background: "#93c5fd",
            borderRadius: "50%",
            filter: "blur(90px)",
            opacity: 0.5,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "6px",
              textTransform: "uppercase",
              color: "#1a1a1a",
              border: "2px solid #1a1a1a",
              padding: "10px 18px",
              alignSelf: "flex-start",
              background: "#fff",
            }}
          >
            DAILY RESEARCH DIGEST
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: "120px",
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: "#1a1a1a",
              display: "flex",
            }}
          >
            Learning et al.
          </div>
          <div
            style={{
              fontSize: "36px",
              color: "#555",
              lineHeight: 1.3,
              maxWidth: "900px",
              display: "flex",
            }}
          >
            One provocative question a day. Papers as tools to think with.
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "#1a1a1a",
              fontFamily: "monospace",
              marginTop: "12px",
              display: "flex",
            }}
          >
            learningetal.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
