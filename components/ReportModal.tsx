"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getDeviceId } from "@/lib/device";
import { REPORT_REASONS, type ReportReason } from "@/lib/report";

export interface ReportTarget {
  id: string;
  nickname: string;
  thumbnailUrl: string;
}

/**
 * 그림 신고 모달 — 사이드바 스트립과 히스토리 목록이 함께 쓴다.
 *
 * 결과를 모달 안에서 직접 보여준다(성공 화면·인라인 오류). 히스토리 페이지에는
 * 캔버스 쪽 토스트가 없으므로, 호출부마다 피드백 수단을 따로 만들지 않기 위함이다.
 */
export function ReportModal({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!target) return null;

  const reasonLabel: Record<ReportReason, string> = {
    inappropriate: t.reportReasonInappropriate,
    sexual: t.reportReasonSexual,
    hate: t.reportReasonHate,
    other: t.reportReasonOther,
  };

  const close = () => {
    if (sending) return;
    onClose();
    // 닫는 애니메이션 없이 즉시 언마운트되므로 다음 열림을 위해 상태를 되돌린다
    setReason("inappropriate");
    setError("");
    setDone(false);
  };

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/drawings/${target.id}/report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      if (res.status === 409) setError(t.reportDuplicate);
      else if (res.status === 429) setError(t.reportTooMany);
      else setError(t.reportFailed);
    } catch {
      setError(t.reportFailed);
    } finally {
      setSending(false);
    }
  };

  const btn: React.CSSProperties = {
    height: 38,
    padding: "0 16px",
    borderRadius: 11,
    border: "1px solid var(--line)",
    background: "var(--solid)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(10, 12, 16, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        animation: "popIn .2s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(340px, 100%)",
          background: "var(--solid)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          boxShadow: "var(--shadow)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {done ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#22A06B" }}>✓</span>
              {t.reportDone}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6 }}>{t.reportDoneDesc}</div>
            <button onClick={close} style={{ ...btn, alignSelf: "flex-end" }}>
              {t.close}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>🚩 {t.reportTitle}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 12,
                  background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                  border: "1px solid var(--line)",
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                <img
                  src={target.thumbnailUrl}
                  alt=""
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6, minWidth: 0 }}>
                <b style={{ color: "var(--text)" }}>{target.nickname}</b>
                <div>{t.reportDesc}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 12px",
                    borderRadius: 11,
                    border: `1px solid ${reason === r ? "var(--accent)" : "var(--line)"}`,
                    background: reason === r ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                    fontSize: 13,
                    fontWeight: reason === r ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    style={{ accentColor: "var(--accent)", margin: 0 }}
                  />
                  {reasonLabel[r]}
                </label>
              ))}
            </div>

            {error && <div style={{ fontSize: 12, color: "#e5484d" }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={close} disabled={sending} style={btn}>
                {t.cancel}
              </button>
              <button
                onClick={submit}
                disabled={sending}
                style={{
                  ...btn,
                  border: "none",
                  background: "#e5484d",
                  color: "#fff",
                  fontWeight: 700,
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? t.reportSubmitting : t.reportSubmit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
