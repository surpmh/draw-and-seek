"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";


export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onPointerDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(12, 14, 18, .4)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        data-screen-label="Help Modal"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "100%",
          maxHeight: "84vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--solid)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
          animation: "popIn .35s cubic-bezier(.3,1.3,.5,1) both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{t.helpTitle}</div>
          <button className="icon-btn" onClick={onClose} title={t.close} style={{ width: 28, height: 28, fontSize: 14 }}>
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {t.helpSteps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "color-mix(in oklab, var(--accent) 14%, transparent)",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.65 }}>{s.body}</div>
              </div>
            </div>
          ))}

          <div
            style={{
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "color-mix(in oklab, var(--text) 3%, transparent)",
              padding: "13px 15px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7 }}>{t.cautionsTitle}</div>
            <ul style={{ margin: 0, paddingLeft: 17, display: "flex", flexDirection: "column", gap: 4 }}>
              {t.cautions.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: "1px solid color-mix(in oklab, var(--accent) 25%, transparent)",
              background: "color-mix(in oklab, var(--accent) 7%, transparent)",
              padding: "13px 15px",
              fontSize: 12,
              color: "var(--text2)",
              lineHeight: 1.65,
            }}
          >
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{t.tipLabel}</span> — {t.tip}
          </div>
        </div>
      </div>
    </div>
  );
}
