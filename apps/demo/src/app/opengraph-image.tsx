import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px",
          background:
            "linear-gradient(180deg, rgb(251,247,241) 0%, rgb(242,235,224) 100%)",
          color: "rgb(32,25,17)"
        }}
      >
        <div
          style={{
            display: "flex",
            border: "1px solid rgba(53,36,10,0.16)",
            borderRadius: 999,
            padding: "10px 16px",
            fontSize: 28,
            alignSelf: "flex-start"
          }}
        >
          Open-source AI form engine
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 86,
              lineHeight: 1,
              letterSpacing: -3
            }}
          >
            OpenSphinx
          </div>
          <div
            style={{
              maxWidth: 880,
              fontSize: 34,
              lineHeight: 1.35,
              color: "rgb(102,89,73)"
            }}
          >
            Adaptive, server-driven question flows with typed schemas, a generation
            engine, and a React renderer.
          </div>
        </div>
      </div>
    ),
    size
  );
}
