import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b1e23",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 13 C 6 8, 8 8, 10 10 C 12 12, 14 12, 16 7"
            stroke="#4f8cff"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="13.2" cy="12.2" r="3.4" stroke="#f1f3f6" strokeWidth="1.6" fill="none" />
          <line x1="15.6" y1="14.6" x2="18" y2="17" stroke="#f1f3f6" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
