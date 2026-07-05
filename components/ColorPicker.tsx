"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clamp255 = (n: number) => clamp(Math.round(n), 0, 255);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1)}`;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max ? d / max : 0, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

const POP_W = 196;
const POP_H = 214;

/**
 * 자체 컬러 피커 — 스펙트럼 + 색상 슬라이더 + RGB 입력만 제공.
 * (HEX 입력은 패널에 별도로 있고, HSL 표기는 쓰지 않는다)
 */
export function ColorPickerButton({
  color,
  onChange,
  swatchStyle,
  title,
}: {
  color: string;
  onChange: (hex: string) => void;
  swatchStyle: React.CSSProperties;
  title?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  // HSV로 상태를 들면 s=0·v=0에서도 hue가 보존된다
  const [hsv, setHsv] = useState<[number, number, number]>([0, 0, 0]);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dragSv = useRef(false);
  const dragHue = useRef(false);

  const openPicker = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        x: clamp(r.left + r.width / 2 - POP_W / 2, 8, window.innerWidth - POP_W - 8),
        y: Math.max(8, r.top - POP_H - 10),
      });
    }
    const rgb: [number, number, number] = /^#[0-9a-f]{6}$/i.test(color) ? hexToRgb(color) : [27, 30, 35];
    setHsv(rgbToHsv(...rgb));
    setOpen(true);
  };

  const commit = (h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(rgbToHex(...hsvToRgb(h, s, v)));
  };

  const svAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const [h] = hsvRef.current;
    commit(h, clamp((e.clientX - r.left) / r.width, 0, 1), 1 - clamp((e.clientY - r.top) / r.height, 0, 1));
  };

  const hueAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const [, s, v] = hsvRef.current;
    commit(clamp((e.clientX - r.left) / r.width, 0, 1) * 359.9, s, v);
  };

  const setChannel = (ch: 0 | 1 | 2, raw: string) => {
    const n = clamp255(Number(raw) || 0);
    const rgb = hsvToRgb(...hsvRef.current);
    rgb[ch] = n;
    setHsv(rgbToHsv(...rgb));
    onChange(rgbToHex(...rgb));
  };

  // 기본 피커에 내장돼 있던 스포이드 대체 (지원 브라우저에서만 노출)
  const canEyeDrop = typeof window !== "undefined" && "EyeDropper" in window;
  const eyeDrop = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new (window as any).EyeDropper().open();
      const rgb = hexToRgb(r.sRGBHex);
      setHsv(rgbToHsv(...rgb));
      onChange(r.sRGBHex);
    } catch {
      /* 사용자가 취소 */
    }
  };

  const [h, s, v] = hsv;
  const rgb = hsvToRgb(h, s, v);

  const thumb = (left: string, top: string): React.CSSProperties => ({
    position: "absolute",
    left,
    top,
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 1px rgba(0,0,0,.45), 0 1px 4px rgba(0,0,0,.3)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  });

  const numInput: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    height: 26,
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "var(--solid)",
    color: "var(--text)",
    fontSize: 11.5,
    fontFamily: "ui-monospace, monospace",
    textAlign: "center",
    padding: 0,
    outline: "none",
  };

  return (
    <>
      <button ref={btnRef} onClick={openPicker} title={title} style={swatchStyle} />
      {/* 패널에 transform/backdrop-filter가 있어 fixed 기준이 패널로 바뀌므로,
          팝업은 반드시 body 포털로 렌더해야 화면 기준 fixed가 된다 */}
      {open &&
        createPortal(
          <>
          {/* 바깥 클릭 시 닫기 */}
          <div style={{ position: "fixed", inset: 0, zIndex: 69 }} onPointerDown={() => setOpen(false)} />
          <div
            data-screen-label="Color Picker Popover"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              width: POP_W,
              zIndex: 70,
              background: "var(--solid)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              boxShadow: "var(--shadow)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: "popIn .25s cubic-bezier(.3,1.3,.5,1) both",
            }}
          >
            {/* 명도·채도 스펙트럼 */}
            <div
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                dragSv.current = true;
                svAt(e);
              }}
              onPointerMove={(e) => dragSv.current && svAt(e)}
              onPointerUp={() => (dragSv.current = false)}
              style={{
                height: 110,
                borderRadius: 10,
                position: "relative",
                cursor: "crosshair",
                touchAction: "none",
                background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`,
              }}
            >
              <span style={thumb(`${s * 100}%`, `${(1 - v) * 100}%`)} />
            </div>

            {/* 색상(Hue) 슬라이더 */}
            <div
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                dragHue.current = true;
                hueAt(e);
              }}
              onPointerMove={(e) => dragHue.current && hueAt(e)}
              onPointerUp={() => (dragHue.current = false)}
              style={{
                height: 14,
                borderRadius: 999,
                position: "relative",
                cursor: "pointer",
                touchAction: "none",
                background: "linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)",
              }}
            >
              <span style={thumb(`${(h / 360) * 100}%`, "50%")} />
            </div>

            {/* RGB 입력 (표기는 RGB만 — HEX는 패널의 코드 입력칸 사용) */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {(["R", "G", "B"] as const).map((label, i) => (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "stretch" }}>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={rgb[i]}
                    onChange={(e) => setChannel(i as 0 | 1 | 2, e.target.value)}
                    style={numInput}
                  />
                  <span style={{ fontSize: 9.5, color: "var(--text2)", textAlign: "center", fontWeight: 600 }}>{label}</span>
                </div>
              ))}
              {canEyeDrop && (
                <button
                  className="icon-btn"
                  onClick={eyeDrop}
                  title={t.pickFromScreen}
                  style={{ width: 30, height: 26, border: "1px solid var(--line)", color: "var(--text)", fontSize: 13, flexShrink: 0, alignSelf: "flex-start" }}
                >
                  ⌖
                </button>
              )}
            </div>
          </div>
          </>,
          // .hc 안에 렌더해야 CSS 변수(테마)가 유지된다. transform 없는 요소라 fixed 기준은 화면 그대로.
          document.querySelector(".hc") ?? document.body,
        )}
    </>
  );
}
