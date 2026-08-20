import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/constants";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "linear-gradient(135deg, #050505 0%, #131315 100%)",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
            color: "#d4af37",
            display: "flex",
          }}
        >
          Wots TCG Vault
        </div>
        <div style={{ fontSize: 32, color: "#9a978f", marginTop: 16, display: "flex", textAlign: "center" }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size }
  );
}
