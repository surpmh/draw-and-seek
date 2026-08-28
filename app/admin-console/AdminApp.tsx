"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewport } from "@/lib/useViewport";
import { CanvasViewport } from "@/components/CanvasViewport";
import type { CanvasMeta } from "@/lib/tiles";

const NAV_H = 56;

interface AdminDrawing {
  id: string;
  nickname: string;
  deviceId: string;
  hiddenAt: string;
  hiddenMs: number;
  removedAt: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 미처리 신고가 달린 그림 (status=reported) */
interface ReportedDrawing extends AdminDrawing {
  reportCount: number;
  /** 사유 코드 → 건수 */
  reasons: Record<string, number>;
  lastReportedAt: string;
}

/** 신고 사유 코드(lib/report.ts) → 관리자 화면 표기 */
const REASON_LABEL: Record<string, string> = {
  inappropriate: "부적절",
  sexual: "음란",
  hate: "혐오",
  other: "기타",
};

const reasonSummary = (reasons: Record<string, number>) =>
  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${REASON_LABEL[code] ?? code} ${n}`)
    .join(" · ");

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--solid)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  padding: "0 14px",
  outline: "none",
};

/** 우측 슬라이드 패널(신고함·삭제함) 공용 컨테이너 — 헤더 아래를 꽉 채운다 */
const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: NAV_H,
  right: 0,
  bottom: 0,
  width: 300,
  zIndex: 15,
  background: "var(--surface)",
  backdropFilter: "blur(10px) saturate(1.5)",
  WebkitBackdropFilter: "blur(10px) saturate(1.5)",
  borderLeft: "1px solid var(--line)",
  overflowY: "auto",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

/** 패널 안의 그림 카드 썸네일 */
const panelThumbStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 9,
  background: "var(--canvas)",
  border: "1px solid var(--line)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--solid)",
  color: "var(--text)",
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: "inherit",
  padding: "0 14px",
  cursor: "pointer",
};

export default function AdminApp() {
  // 이 페이지는 미들웨어가 비밀 슬러그(ADMIN_SLUG) 요청을 rewrite 해서 서빙한다.
  // 브라우저 URL에는 슬러그가 그대로 남으므로 API 경로를 여기서 파생 — 코드에 비밀이 없다.
  const apiBase = `/api${usePathname()}`;
  const imgUrl = (id: string) => `${apiBase}/drawings/${id}/image`;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  // authed: null=확인 중, false=로그인 필요, true=인증됨
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [meta, setMeta] = useState<CanvasMeta | null>(null);
  const [hidden, setHidden] = useState<AdminDrawing[] | null>(null);
  const [removed, setRemoved] = useState<AdminDrawing[] | null>(null);
  const [reported, setReported] = useState<ReportedDrawing[] | null>(null);
  const [reportsError, setReportsError] = useState("");
  // 우측 패널은 한 번에 하나만 — 신고함과 삭제함이 같은 자리를 쓴다
  const [panel, setPanel] = useState<"reported" | "removed" | null>(null);
  const [error, setError] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<AdminDrawing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const viewport = useViewport(meta);
  const scale = viewport.view.s;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [h, r, rep] = await Promise.all([
        fetch(`${apiBase}/drawings?status=hidden`, { cache: "no-store" }),
        fetch(`${apiBase}/drawings?status=removed`, { cache: "no-store" }),
        fetch(`${apiBase}/drawings?status=reported`, { cache: "no-store" }),
      ]);
      if (h.status === 401 || r.status === 401) {
        setAuthed(false);
        return;
      }
      if (!h.ok) throw new Error(await h.text());
      if (!r.ok) throw new Error(await r.text());
      setHidden(await h.json());
      setRemoved(await r.json());
      // 신고 목록은 실패해도 삭제·복구 기능까지 막지 않는다
      // (reports 테이블 마이그레이션 전이면 여기만 실패한다 — supabase/reports.sql)
      if (rep.ok) {
        setReported(await rep.json());
        setReportsError("");
      } else {
        setReported([]);
        setReportsError(await rep.text());
      }
      setAuthed(true);
    } catch (e) {
      setError((e as Error).message || "목록을 불러오지 못했습니다");
      setAuthed(true); // 인증은 됐지만 목록 실패
    }
  }, [apiBase]);

  // 첫 진입: 세션 쿠키가 살아있는지 목록 요청으로 확인 + 캔버스 메타
  useEffect(() => {
    loadAll();
    fetch("/api/canvas")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeta)
      .catch(() => {});
  }, [loadAll]);

  /** 삭제/복구 후 전역 버전 반영 → 타일 URL 무효화로 캔버스 즉시 갱신 */
  const applyVersion = (version: number | null) => {
    if (version != null) setMeta((m) => (m ? { ...m, version } : m));
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const r = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        setLoginError(await r.text());
        return;
      }
      setPassword("");
      await loadAll();
    } catch {
      setLoginError("네트워크 오류가 발생했습니다");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch(`${apiBase}/login`, { method: "DELETE" }).catch(() => {});
    setAuthed(false);
    setHidden(null);
    setRemoved(null);
    setReported(null);
  };

  const doDelete = async () => {
    if (!confirmTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const r = await fetch(`${apiBase}/drawings/${confirmTarget.id}`, { method: "DELETE" });
      if (r.status === 401) {
        setAuthed(false);
        setConfirmTarget(null);
        return;
      }
      // 404/409 = 이미 삭제됐거나 없는 그림 — 목록에서만 제거
      if (!r.ok && r.status !== 404 && r.status !== 409) throw new Error(await r.text());
      if (r.ok) applyVersion((await r.json()).version);
      const target = confirmTarget;
      setHidden((prev) => (prev ?? []).filter((d) => d.id !== target.id));
      setReported((prev) => (prev ?? []).filter((d) => d.id !== target.id));
      setRemoved((prev) => [{ ...target, removedAt: new Date().toISOString() }, ...(prev ?? [])]);
      setConfirmTarget(null);
    } catch (e) {
      setDeleteError((e as Error).message || "삭제에 실패했습니다");
    } finally {
      setDeleting(false);
    }
  };

  const doRestore = async (d: AdminDrawing) => {
    if (restoringId) return;
    setRestoringId(d.id);
    setError("");
    try {
      const r = await fetch(`${apiBase}/drawings/${d.id}`, { method: "POST" });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      if (!r.ok && r.status !== 409) throw new Error(await r.text());
      if (r.ok) applyVersion((await r.json()).version);
      setRemoved((prev) => (prev ?? []).filter((it) => it.id !== d.id));
      setReported((prev) => (prev ?? []).filter((it) => it.id !== d.id));
      setHidden((prev) => [{ ...d, removedAt: null }, ...(prev ?? [])]);
    } catch (e) {
      setError((e as Error).message || "복구에 실패했습니다");
    } finally {
      setRestoringId(null);
    }
  };

  /** 신고 반려 — "확인했고 문제없음". 그림은 그대로 두고 신고만 내린다 */
  const doDismiss = async (d: ReportedDrawing) => {
    if (dismissingId) return;
    setDismissingId(d.id);
    setError("");
    try {
      const r = await fetch(`${apiBase}/drawings/${d.id}/reports`, { method: "DELETE" });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      setReported((prev) => (prev ?? []).filter((it) => it.id !== d.id));
    } catch (e) {
      setError((e as Error).message || "신고 반려에 실패했습니다");
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div
      className="hc"
      data-theme={theme}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-inter), Inter, -apple-system, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* 헤더 */}
      <nav
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          height: NAV_H,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: "var(--surface)",
          backdropFilter: "blur(10px) saturate(1.5)",
          WebkitBackdropFilter: "blur(10px) saturate(1.5)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link
          href="/"
          title="캔버스로 돌아가기"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            color: "var(--text2)",
            textDecoration: "none",
            fontSize: 16,
          }}
        >
          ←
        </Link>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}>🛡️ 관리자</div>
        {authed && (
          <div style={{ fontSize: 11.5, color: "var(--text2)" }}>
            숨겨진 그림 {hidden?.length ?? "…"}개
          </div>
        )}
        <div style={{ flex: 1 }} />
        {authed && (
          <>
            <button onClick={loadAll} style={{ ...buttonStyle, height: 32 }}>
              새로고침
            </button>
            <button
              onClick={() => setPanel((v) => (v === "reported" ? null : "reported"))}
              style={{
                ...buttonStyle,
                height: 32,
                ...(panel === "reported"
                  ? { background: "#e5484d", color: "#fff", border: "none" }
                  : reported?.length
                    ? { borderColor: "#e5484d", color: "#e5484d" }
                    : {}),
              }}
            >
              🚩 신고 {reported?.length ?? 0}
            </button>
            <button
              onClick={() => setPanel((v) => (v === "removed" ? null : "removed"))}
              style={{
                ...buttonStyle,
                height: 32,
                ...(panel === "removed" ? { background: "var(--accent)", color: "#fff", border: "none" } : {}),
              }}
            >
              삭제된 그림 {removed?.length ?? 0}
            </button>
            <button onClick={logout} style={{ ...buttonStyle, height: 32 }}>
              로그아웃
            </button>
          </>
        )}
      </nav>

      {/* 확인 중 */}
      {authed === null && (
        <div style={{ position: "relative", zIndex: 25, paddingTop: 140, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
          확인 중…
        </div>
      )}

      {/* 로그인 */}
      {authed === false && (
        <form
          onSubmit={login}
          style={{
            position: "relative",
            zIndex: 25,
            maxWidth: 340,
            margin: "140px auto 0",
            padding: "28px 24px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            boxShadow: "var(--shadow)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>관리자 로그인</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            style={inputStyle}
          />
          {loginError && <div style={{ fontSize: 12, color: "#e5484d" }}>{loginError}</div>}
          <button
            type="submit"
            disabled={loggingIn || !password}
            style={{
              ...buttonStyle,
              height: 40,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              opacity: loggingIn || !password ? 0.6 : 1,
            }}
          >
            {loggingIn ? "확인 중…" : "로그인"}
          </button>
        </form>
      )}

      {/* 캔버스 — 일반 유저와 동일한 뷰 + 숨은 그림 표시 오버레이.
          meta 로드 즉시 마운트해야 useViewport의 ResizeObserver가 부착돼 초기 fit이 동작한다
          (타일은 공개 데이터, 숨은 그림 표시는 인증 후에만) */}
      {meta && (
        <CanvasViewport meta={meta} viewport={viewport} topInset={NAV_H}>
          {authed && hidden?.map((d) => (
            <div
              key={d.id}
              style={{
                position: "absolute",
                left: d.x,
                top: d.y,
                width: d.w,
                height: d.h,
                border: `${2 / scale}px solid #e5484d`,
                borderRadius: 4 / scale,
                boxShadow: `0 0 0 ${1.5 / scale}px rgba(255,255,255,0.7)`,
                pointerEvents: "none",
              }}
            >
              <button
                title={`${d.nickname} — ${fmtDate(d.hiddenAt)} 숨김 · 삭제`}
                onPointerDown={(e) => e.stopPropagation() /* 팬 시작 방지 */}
                onClick={() => {
                  setDeleteError("");
                  setConfirmTarget(d);
                }}
                style={{
                  position: "absolute",
                  top: -14 / scale,
                  right: -14 / scale,
                  width: 24 / scale,
                  height: 24 / scale,
                  borderRadius: "50%",
                  border: `${1.5 / scale}px solid #fff`,
                  background: "#e5484d",
                  color: "#fff",
                  fontSize: 13 / scale,
                  lineHeight: 1,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  pointerEvents: "auto",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </CanvasViewport>
      )}

      {/* 줌 컨트롤 */}
      {authed && meta && (
        <div
          style={{
            position: "absolute",
            right: panel ? 316 : 16,
            bottom: 16,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {(
            [
              ["+", viewport.zoomIn],
              ["−", viewport.zoomOut],
              ["⤢", viewport.resetView],
            ] as const
          ).map(([label, fn]) => (
            <button
              key={label}
              onClick={fn}
              style={{ ...buttonStyle, width: 36, height: 36, padding: 0, fontSize: 15, boxShadow: "var(--shadow)" }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 오류 토스트 */}
      {authed && error && (
        <div
          style={{
            position: "absolute",
            top: NAV_H + 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            background: "var(--solid)",
            border: "1px solid #e5484d",
            color: "#e5484d",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 12.5,
          }}
        >
          {error}
        </div>
      )}

      {/* 신고된 그림 패널 — 삭제(제재) 또는 반려(문제없음) */}
      {authed && panel === "reported" && (
        <div style={panelStyle}>
          {reportsError && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5484d",
                color: "#e5484d",
                fontSize: 11.5,
                lineHeight: 1.6,
              }}
            >
              신고 목록을 불러오지 못했습니다.
              <div style={{ marginTop: 4, opacity: 0.85, wordBreak: "break-all" }}>{reportsError}</div>
            </div>
          )}
          {!reportsError && reported?.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
              신고된 그림이 없습니다.
            </div>
          )}
          {reported?.map((d) => (
            <div
              key={d.id}
              style={{
                background: "var(--solid)",
                border: "1px solid color-mix(in oklab, #e5484d 35%, var(--line))",
                borderRadius: 12,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={panelThumbStyle}>
                  <img
                    src={imgUrl(d.id)}
                    alt=""
                    style={{ maxWidth: 46, maxHeight: 46, objectFit: "contain" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.nickname}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#e5484d", marginTop: 3 }}>
                    신고 {d.reportCount}건
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text2)", marginTop: 2 }}>
                    {reasonSummary(d.reasons)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text2)", marginTop: 2 }}>
                    최근 {fmtDate(d.lastReportedAt)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  onClick={() => doDismiss(d)}
                  disabled={dismissingId !== null}
                  style={{
                    ...buttonStyle,
                    height: 30,
                    fontSize: 11.5,
                    color: "var(--text2)",
                    opacity: dismissingId && dismissingId !== d.id ? 0.5 : 1,
                  }}
                >
                  {dismissingId === d.id ? "처리 중…" : "문제없음"}
                </button>
                <button
                  onClick={() => {
                    setDeleteError("");
                    setConfirmTarget(d);
                  }}
                  style={{
                    ...buttonStyle,
                    height: 30,
                    fontSize: 11.5,
                    border: "none",
                    background: "#e5484d",
                    color: "#fff",
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제된 그림 패널 (복구) */}
      {authed && panel === "removed" && (
        <div style={panelStyle}>
          {removed?.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
              삭제된 그림이 없습니다.
            </div>
          )}
          {removed?.map((d) => (
            <div
              key={d.id}
              style={{
                background: "var(--solid)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 10,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={panelThumbStyle}>
                <img
                  src={imgUrl(d.id)}
                  alt=""
                  style={{ maxWidth: 46, maxHeight: 46, objectFit: "contain" }}
                  loading="lazy"
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.nickname}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text2)", marginTop: 2 }}>
                  {d.removedAt ? `${fmtDate(d.removedAt)} 삭제` : ""}
                </div>
              </div>
              <button
                onClick={() => doRestore(d)}
                disabled={restoringId !== null}
                style={{
                  ...buttonStyle,
                  height: 30,
                  fontSize: 11.5,
                  color: "var(--accent)",
                  opacity: restoringId && restoringId !== d.id ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {restoringId === d.id ? "복구 중…" : "복구"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmTarget && (
        <div
          onClick={() => !deleting && setConfirmTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0, 0, 0, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(360px, 100%)",
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
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>이 그림을 삭제할까요?</div>
            <div
              style={{
                height: 120,
                borderRadius: 10,
                background: "var(--canvas)",
                border: "1px solid var(--line)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={imgUrl(confirmTarget.id)}
                alt=""
                style={{ maxWidth: "100%", maxHeight: 112, objectFit: "contain" }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--text)" }}>{confirmTarget.nickname}</b>님의 그림
              ({fmtDate(confirmTarget.hiddenAt)} 숨김)이 캔버스와 기록에서 사라집니다.
              실수라면 <b>삭제된 그림</b> 패널에서 언제든 복구할 수 있어요.
            </div>
            {deleteError && <div style={{ fontSize: 12, color: "#e5484d" }}>{deleteError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmTarget(null)} disabled={deleting} style={buttonStyle}>
                취소
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                style={{
                  ...buttonStyle,
                  border: "none",
                  background: "#e5484d",
                  color: "#fff",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
