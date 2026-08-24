import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)",
          borderRadius: 112,
        }}
      >
        <div style={{ position: "relative", width: 200, height: 176, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 100,
              height: 100,
              background: "#fb7185",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 100,
              height: 100,
              background: "#fb7185",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 28,
              width: 142,
              height: 142,
              background: "#fb7185",
              borderRadius: 24,
              transform: "rotate(45deg)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
