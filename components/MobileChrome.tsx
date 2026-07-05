"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { ERASER_SCALE, type DrawPad } from "@/lib/useDrawPad";
import { ColorPickerButton } from "./ColorPicker";
import { CHECKER, PenIcon, FillIcon, EraserIcon, UndoIcon, eraserCursor } from "./DrawingPanel";
import type { DrawingItem } from "./Sidebar";
import { useI18n } from "@/lib/i18n";

/**
 * 모바일 전용 크롬 (시안: Hidden Canvas Mobile.dc.html)
 * — 플로팅 앱바 · 하단 액션 필 · 숨은 그림 바텀시트 · 그리기 드로어.
 * 캔버스/업로드/찾기 로직은 데스크톱과 공유하고 표면만 바꾼다.
 */

const PALETTE = ["#1b1e23", "#ffffff", "#4f8cff", "#ff6b5e", "#ffb020", "#22a06b"];
const ringOn = "0 0 0 2px var(--solid), 0 0 0 4px var(--accent)";
const ringOff = "inset 0 0 0 1px rgba(128,128,128,.25)";

const sheetBase: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 55,
  background: "var(--surface)",
  backdropFilter: "blur(24px) saturate(1.6)",
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  border: "1px solid var(--line)",
  borderBottom: "none",
  borderRadius: "22px 22px 0 0",
  boxShadow: "var(--shadow)",
  transition: "transform .45s cubic-bezier(.22,1,.36,1)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

function SheetHandle({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      style={{ border: "none", background: "transparent", padding: "10px 0 6px", cursor: "pointer", display: "flex", justifyContent: "center", flexShrink: 0 }}
    >
      <span style={{ width: 36, height: 5, borderRadius: 999, background: "color-mix(in oklab, var(--text) 22%, transparent)", display: "block" }} />
    </button>
  );
}

/** 상단 플로팅 앱바 */
export function MobileAppBar({ remain, onHelp }: { remain: number; onHelp: () => void }) {
  const { t } = useI18n();
  return (
    <div
      data-screen-label="Mobile App Bar"
      style={{
        position: "fixed",
        top: "calc(10px + env(safe-area-inset-top))",
        left: 12,
        right: 12,
        zIndex: 40,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 6px 0 12px",
        background: "var(--surface)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #8b5cf6))",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,.92)" }} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>Draw & Seek</div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--accent)",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: "color-mix(in oklab, var(--accent) 12%, transparent)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {t.remainCount(remain)}
        </div>
      </div>
      <button className="icon-btn" onClick={onHelp} title={t.helpButton} style={{ width: 36, height: 36, flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
    </div>
  );
}

/** 하단 액션 필 2개 — 숨은 그림 시트 · 그리기 드로어 */
export function MobileActionPills({
  remain,
  onOpenSheet,
  onOpenDrawer,
}: {
  remain: number;
  onOpenSheet: () => void;
  onOpenDrawer: () => void;
}) {
  const { t } = useI18n();
  const pill: React.CSSProperties = {
    height: 44,
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 7,
  };
  return (
    <div
      data-screen-label="Mobile Bottom Actions"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(14px + env(safe-area-inset-bottom))",
        zIndex: 37,
        display: "flex",
        justifyContent: "center",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <button
        onClick={onOpenSheet}
        style={{
          ...pill,
          pointerEvents: "auto",
          padding: "0 18px",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          backdropFilter: "blur(18px) saturate(1.6)",
          WebkitBackdropFilter: "blur(18px) saturate(1.6)",
          boxShadow: "var(--shadow)",
          color: "var(--text)",
        }}
      >
        🖼️ {t.remainCount(remain)}
      </button>
      <button
        onClick={onOpenDrawer}
        style={{
          ...pill,
          pointerEvents: "auto",
          padding: "0 20px",
          border: "none",
          background: "var(--accent)",
          boxShadow: "0 6px 18px color-mix(in oklab, var(--accent) 40%, transparent)",
          color: "#fff",
          fontWeight: 700,
        }}
      >
        ✏️ {t.draw}
      </button>
    </div>
  );
}

/** 숨은 그림 / Top 10 바텀시트 */
export function MobileSheet({ items, open, onClose }: { items: DrawingItem[]; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"hidden" | "rank">("hidden");

  const hiddenLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    if (days >= 1) return t.hiddenForDays(days);
    const hours = Math.floor(ms / 3600_000);
    if (hours >= 1) return t.hiddenForHours(hours);
    return t.justHidden;
  };
  const badgeLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    if (days >= 1) return t.badgeDays(days);
    const hours = Math.floor(ms / 3600_000);
    if (hours >= 1) return t.badgeHours(hours);
    return t.badgeNew;
  };
  const top = [...items].sort((a, b) => b.hiddenMs - a.hiddenMs).slice(0, 10);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: 36,
    borderRadius: 11,
    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
    background: active ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
    color: "var(--text)",
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  });

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 54, background: "rgba(10,12,16,.28)", animation: "popIn .25s ease both" }} />
      )}
      <div
        data-screen-label="Hidden Drawings Sheet"
        style={{
          ...sheetBase,
          height: "min(480px, 72dvh)",
          transform: open ? "translateY(0)" : "translateY(112%)",
        }}
      >
        <SheetHandle onClose={onClose} />
        <div style={{ display: "flex", gap: 6, padding: "4px 16px 12px", flexShrink: 0 }}>
          <button onClick={() => setTab("hidden")} style={tabBtn(tab === "hidden")}>
            {t.filterHidden}
          </button>
          <button onClick={() => setTab("rank")} style={tabBtn(tab === "rank")}>
            🏆 {t.rankingPill}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          {tab === "hidden" &&
            items.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                    border: "1px solid var(--line)",
                    boxShadow: it.isMine ? "0 0 0 2px var(--accent)" : undefined,
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img src={it.thumbnailUrl} alt="" style={{ maxWidth: 38, maxHeight: 38, objectFit: "contain" }} loading="lazy" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    by {it.nickname}
                    {it.isMine && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>{t.myDrawing}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 2 }}>{hiddenLabel(it.hiddenMs)}</div>
                </div>
              </div>
            ))}
          {tab === "hidden" && items.length === 0 && (
            <div style={{ padding: "36px 12px", textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>{t.emptyTitle}</div>
          )}

          {tab === "rank" &&
            top.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 14 }}>
                <div
                  style={{
                    width: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: i === 0 ? "var(--accent)" : "var(--text2)",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                    border: "1px solid var(--line)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img src={r.thumbnailUrl} alt="" style={{ maxWidth: 32, maxHeight: 32, objectFit: "contain" }} loading="lazy" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nickname}</div>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                    borderRadius: 999,
                    padding: "4px 9px",
                    flexShrink: 0,
                  }}
                >
                  {badgeLabel(r.hiddenMs)}
                </div>
              </div>
            ))}
          {tab === "rank" && top.length === 0 && (
            <div style={{ padding: "36px 12px", textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>{t.rankingEmpty}</div>
          )}
        </div>
        {tab === "rank" && (
          <Link
            href="/history"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px calc(12px + env(safe-area-inset-bottom))",
              borderTop: "1px solid var(--line)",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text2)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <span>{t.rankingHistoryLink}</span>
            <span>→</span>
          </Link>
        )}
      </div>
    </>
  );
}

/** 그리기 드로어 — 항상 마운트(translateY로 숨김)해서 그리던 내용을 보존한다 */
export const MobileDrawingDrawer = memo(function MobileDrawingDrawer({
  pad,
  open,
  onClose,
  onUpload,
}: {
  pad: DrawPad;
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}) {
  const { t } = useI18n();

  const toolBtn = (active: boolean): React.CSSProperties => ({
    width: 44,
    height: 38,
    borderRadius: 11,
    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
    background: active ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
    color: "var(--text)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  });

  return (
    <div
      data-screen-label="Mobile Drawing Drawer"
      style={{
        ...sheetBase,
        transform: open ? "translateY(0)" : "translateY(112%)",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <SheetHandle onClose={onClose} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 8px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.draw}</div>
        <div style={{ fontSize: 11, color: "var(--text2)" }}>{t.drawHint}</div>
      </div>

      {/* 도구 + 팔레트 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 10px" }}>
        <button onClick={() => pad.setTool("pen")} title={t.toolPen} style={toolBtn(pad.tool === "pen")}>
          <PenIcon />
        </button>
        <button onClick={() => pad.setTool("fill")} title={t.toolFill} style={toolBtn(pad.tool === "fill")}>
          <FillIcon />
        </button>
        <button onClick={() => pad.setTool("eraser")} title={t.toolEraser} style={toolBtn(pad.tool === "eraser")}>
          <EraserIcon />
        </button>
        <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 7, alignItems: "center", flex: 1, minWidth: 0, overflowX: "auto" }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => pad.setColor(c)}
              title={c}
              style={{
                width: 22,
                height: 22,
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
          <ColorPickerButton
            color={pad.color}
            onChange={pad.setColor}
            title={t.pickColor}
            swatchStyle={{
              width: 22,
              height: 22,
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
      </div>

      {/* 굵기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 10px" }}>
        <span style={{ fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>{t.brush}</span>
        <input
          type="range"
          min={5}
          max={26}
          value={pad.brush}
          onChange={(e) => pad.setBrush(+e.target.value)}
          style={{ flex: 1, minWidth: 0, accentColor: "var(--accent)", height: 24 }}
        />
        <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", flexShrink: 0 }}>
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

      {/* 패드 — 배치 프레임과 같은 정사각 비율 (WYSIWYG 크기 계산이 정사각을 전제) */}
      <div style={{ display: "flex", justifyContent: "center", padding: "0 16px" }}>
        <div
          style={{
            width: "min(100%, 38dvh)",
            aspectRatio: "1 / 1",
            position: "relative",
            borderRadius: 14,
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
      </div>

      {/* undo · redo · clear · upload */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        <button
          className="icon-btn"
          onClick={pad.undo}
          title={t.undo}
          style={{ width: 44, height: 40, border: "1px solid var(--line)", color: "var(--text)", opacity: pad.canUndo ? 1 : 0.35 }}
        >
          <UndoIcon />
        </button>
        <button
          className="icon-btn"
          onClick={pad.redo}
          title={t.redo}
          style={{ width: 44, height: 40, border: "1px solid var(--line)", color: "var(--text)", opacity: pad.canRedo ? 1 : 0.35 }}
        >
          <UndoIcon mirrored />
        </button>
        <button
          className="icon-btn"
          onClick={pad.clear}
          title={t.clear}
          style={{ width: 56, height: 40, border: "1px solid var(--line)", color: "var(--text2)", fontSize: 11.5, fontWeight: 600 }}
        >
          Clear
        </button>
        <button
          onClick={onUpload}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: "0 6px 18px color-mix(in oklab, var(--accent) 40%, transparent)",
          }}
        >
          ↑ {t.upload}
        </button>
      </div>
    </div>
  );
});
