"use client";

import { memo, useEffect, useState } from "react";
import { ERASER_SCALE, type DrawPad } from "@/lib/useDrawPad";
import { ColorPickerButton } from "./ColorPicker";
import { useI18n } from "@/lib/i18n";

const PALETTE = ["#1b1e23", "#ffffff", "#4f8cff", "#ff6b5e", "#ffb020", "#22a06b"];

// 투명 배경임을 알리는 체커보드 (data URI, 라이트/다크 공통으로 은은하게)
export const CHECKER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23e9e9ec'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e9e9ec'/%3E%3C/svg%3E\")";

const ringOn = "0 0 0 2px var(--solid), 0 0 0 4px var(--accent)";
const ringOff = "inset 0 0 0 1px rgba(128,128,128,.25)";

const toolSvg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function PenIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...toolSvg}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function FillIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...toolSvg}>
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
      <path d="m5 2 5 5" />
      <path d="M2 13h15" />
      <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
    </svg>
  );
}

export function EraserIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...toolSvg}>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

/** 납작한 비율의 언두 화살표 (글리프 ↶는 폰트에 따라 세로로 길쭉해서 SVG로 직접 그림). mirrored=리두 */
export function UndoIcon({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      width="15"
      height="13"
      viewBox="0 0 15 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M2 4.5h8a3.5 3.5 0 0 1 0 7H6.5" />
      <path d="M5 1.5 2 4.5l3 3" />
    </svg>
  );
}

/** 지워질 영역을 그대로 보여주는 속 빈 원형 커서 — 밝은/어두운 배경 모두에서 보이도록 이중 링 */
export const eraserCursor = (diameter: number) => {
  const s = Math.ceil(diameter) + 4;
  const c = s / 2;
  const r = diameter / 2;
  const svg =
    `%3Csvg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'%3E` +
    `%3Ccircle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='rgba(255,255,255,.9)' stroke-width='2.5'/%3E` +
    `%3Ccircle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='rgba(20,22,26,.8)' stroke-width='1'/%3E` +
    `%3C/svg%3E`;
  return `url("data:image/svg+xml,${svg}") ${Math.round(c)} ${Math.round(c)}, crosshair`;
};

/** memo: 뷰포트 팬/줌으로 앱이 리렌더돼도 패널은 자기 상태가 바뀔 때만 다시 그린다 */
export const DrawingPanel = memo(function DrawingPanel({
  pad,
  open,
  onToggle,
  onUpload,
  minimap,
}: {
  pad: DrawPad;
  open: boolean;
  onToggle: () => void;
  onUpload: () => void;
  /** 지도 축소판과 기본 배치 크기 비율 (sizeRatio = DEFAULT_LONG / 지도 폭) */
  minimap?: { url: string; sizeRatio: number };
}) {
  const { t } = useI18n();
  // 헥스 코드 직접 입력 (유효할 때만 반영)
  const [hexDraft, setHexDraft] = useState(pad.color);
  useEffect(() => {
    setHexDraft(pad.color);
  }, [pad.color]);

  const commitHex = (raw: string) => {
    setHexDraft(raw);
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) pad.setColor(v.toLowerCase());
  };

  if (!open) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          left: "50%",
          bottom: 16,
          transform: "translateX(-50%)",
          zIndex: 36,
          height: 40,
          padding: "0 18px",
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          backdropFilter: "blur(10px) saturate(1.5)",
          WebkitBackdropFilter: "blur(10px) saturate(1.5)",
          boxShadow: "var(--shadow)",
          color: "var(--text)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          animation: "popInCentered .3s ease both", // translateX(-50%) 유지 — 중앙 정렬 보존
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <PenIcon size={13} /> {t.draw} <span style={{ color: "var(--text2)", fontWeight: 500 }}>{t.openPanel} ⌃</span>
      </button>
    );
  }

  const tbtn = (active: boolean) => ({
    flex: 1,
    height: 34,
    borderRadius: 10,
    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
    background: active ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 14,
    display: "grid",
    placeItems: "center",
    transition: "all .2s",
  });

  return (
    <section
      data-screen-label="Drawing Panel"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        width: 630, // 좌 도구(190) + 정사각 패드(~186) + 우 미니맵/업로드(190) + 여백
        maxWidth: "calc(100vw - 152px)",
        height: 250,
        zIndex: 36,
        transform: "translateX(-50%)",
        background: "var(--surface)",
        backdropFilter: "blur(10px) saturate(1.5)",
        WebkitBackdropFilter: "blur(10px) saturate(1.5)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}>{t.draw}</div>
          <div style={{ fontSize: 11.5, color: "var(--text2)" }}>
            {t.drawHint}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={onToggle}
          title={t.collapsePanel}
          style={{ width: 26, height: 26, fontSize: 13 }}
        >
          ⌄
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 14, padding: "0 14px 14px", minHeight: 0 }}>
        {/* 좌: 도구 */}
        <div style={{ width: 190, display: "flex", flexDirection: "column", gap: 9, flexShrink: 0 }}>
          {/* 도구: 펜 → 채우기 → 지우개 (스포이드는 컬러 피커에 내장) */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => pad.setTool("pen")} title={t.toolPen} style={tbtn(pad.tool === "pen")}>
              <PenIcon />
            </button>
            <button onClick={() => pad.setTool("fill")} title={t.toolFill} style={tbtn(pad.tool === "fill")}>
              <FillIcon />
            </button>
            <button onClick={() => pad.setTool("eraser")} title={t.toolEraser} style={tbtn(pad.tool === "eraser")}>
              <EraserIcon />
            </button>
          </div>

          {/* 팔레트 + 커스텀 피커 */}
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => pad.setColor(c)}
                title={c}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "none",
                  padding: 0,
                  background: c,
                  boxShadow: pad.color === c ? ringOn : ringOff,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
            ))}
            {/* 자체 스펙트럼 피커 — 무지개 원 클릭 (RGB 표기만, 스포이드 내장) */}
            <ColorPickerButton
              color={pad.color}
              onChange={pad.setColor}
              title={t.pickColor}
              swatchStyle={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                background: "conic-gradient(#f66,#fd6,#6d6,#6dd,#66f,#d6d,#f66)",
                boxShadow: PALETTE.includes(pad.color) ? ringOff : ringOn,
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          </div>

          {/* 색상 코드 입력 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: pad.color,
                boxShadow: ringOff,
                flexShrink: 0,
              }}
            />
            <input
              value={hexDraft}
              onChange={(e) => commitHex(e.target.value)}
              spellCheck={false}
              maxLength={7}
              placeholder="#1b1e23"
              style={{
                flex: 1,
                minWidth: 0,
                height: 26,
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--solid)",
                color: "var(--text)",
                fontSize: 11.5,
                fontFamily: "ui-monospace, monospace",
                padding: "0 8px",
                outline: "none",
              }}
            />
          </div>

          {/* 굵기 (미리보기 셀 고정 크기 — 최대 굵기에서도 잘리지 않음) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30 }}>
            <span style={{ fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>{t.brush}</span>
            <input
              type="range"
              min={5}
              max={26}
              value={pad.brush}
              onChange={(e) => pad.setBrush(+e.target.value)}
              style={{ flex: 1, minWidth: 0, accentColor: "var(--accent)", height: 22 }}
            />
            <span
              style={{
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                overflow: "visible",
              }}
            >
              <span
                style={{
                  width: Math.min(pad.brush, 26),
                  height: Math.min(pad.brush, 26),
                  borderRadius: "50%",
                  background: pad.color,
                  boxShadow: ringOff,
                  display: "block",
                }}
              />
            </span>
          </div>

          {/* undo · redo · clear */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="icon-btn"
              onClick={pad.undo}
              title="Undo"
              style={{ flex: 1, height: 32, border: "1px solid var(--line)", color: "var(--text)", opacity: pad.canUndo ? 1 : 0.35 }}
            >
              <UndoIcon />
            </button>
            <button
              className="icon-btn"
              onClick={pad.redo}
              title="Redo"
              style={{ flex: 1, height: 32, border: "1px solid var(--line)", color: "var(--text)", opacity: pad.canRedo ? 1 : 0.35 }}
            >
              <UndoIcon mirrored />
            </button>
            <button
              className="icon-btn"
              onClick={pad.clear}
              title="Clear"
              style={{ flex: 1, height: 32, border: "1px solid var(--line)", color: "var(--text2)", fontSize: 11.5, fontWeight: 600 }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* 중: 패드 (정사각 — 배치 프레임과 동일 비율, 체커보드 = 투명 배경 표시) */}
        <div
          style={{
            height: "100%",
            aspectRatio: "1 / 1",
            flexShrink: 0,
            position: "relative",
            borderRadius: 12,
            background: CHECKER,
            backgroundColor: "var(--pad)",
            border: "1px solid var(--line)",
            overflow: "hidden",
          }}
        >
          <canvas
            ref={pad.canvasRefCb}
            onPointerDown={pad.onPointerDown}
            onPointerMove={pad.onPointerMove}
            onPointerUp={pad.onPointerUp}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              touchAction: "none",
              cursor: pad.tool === "eraser" ? eraserCursor(pad.brush * ERASER_SCALE) : "crosshair",
            }}
          />
        </div>

        {/* 우: 미니맵 + 업로드 */}
        <div style={{ width: 190, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {/* 미니맵 스케일 프리뷰 — 기본 배치 크기가 캔버스에서 차지하는 비율 */}
          {minimap && (
            <div
              title={t.minimapTitle}
              style={{
                position: "relative",
                width: "100%",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--line)",
                lineHeight: 0,
              }}
            >
              <img src={minimap.url} alt="" style={{ width: "100%", display: "block", opacity: 0.92 }} />
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "42%",
                  transform: "translate(-50%,-50%)",
                  width: `${Math.max(5, minimap.sizeRatio * 100)}%`,
                  aspectRatio: "1",
                  border: "2px solid var(--accent)",
                  borderRadius: 3,
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,.9), 0 0 10px color-mix(in oklab, var(--accent) 80%, transparent)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "14px 6px 5px",
                  background: "linear-gradient(transparent, rgba(0,0,0,.55))",
                  color: "#fff",
                  fontSize: 10.5,
                  fontWeight: 600,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {t.minimapLabel}
              </div>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onUpload}
            style={{
              height: 42,
              borderRadius: 12,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 6px 18px color-mix(in oklab, var(--accent) 40%, transparent)",
              transition: "filter .2s, transform .15s",
            }}
          >
            ↑ {t.upload}
          </button>
        </div>
      </div>
    </section>
  );
});
