import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e8",
          color: "#ba4b2f",
          fontSize: 32,
          fontWeight: 700
        }}
      >
        S
      </div>
    ),
    size
  );
}
