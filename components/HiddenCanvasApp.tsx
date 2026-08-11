"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasMeta } from "@/lib/tiles";
import { useViewport } from "@/lib/useViewport";
import { useDrawPad } from "@/lib/useDrawPad";
import {
  type Placing,
  MIN_LONG,
  MAX_LONG,
  sizeFromLong,
  clampToCanvas,
  MIN_INK_WORLD,
  ALPHA_VISIBLE,
} from "@/lib/placement";
import { getDeviceId, getLastNickname, saveNickname, isEmptyNoticeDismissed, dismissEmptyNotice } from "@/lib/device";
import { CanvasViewport } from "./CanvasViewport";
import { DrawingPanel } from "./DrawingPanel";
import { PlacementOverlay } from "./PlacementOverlay";
import { PlacementStepper } from "./PlacementStepper";
import { Sidebar, type DrawingItem } from "./Sidebar";
import { RankingPanel } from "./RankingPanel";
import { FoundAnimation, MissRipple, type FoundAnim } from "./FoundAnimation";
import { HelpModal } from "./HelpModal";
import { MobileAppBar, MobileActionPills, MobileSheet, MobileDrawingDrawer } from "./MobileChrome";
import { useIsMobile } from "@/lib/useIsMobile";
import { useI18n } from "@/lib/i18n";

const POLL_MS = 30_000;

export default function HiddenCanvasApp() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [meta, setMeta] = useState<CanvasMeta | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // 시스템 테마 추종 (토글 없음)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [fs, setFs] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [rankingOpen, setRankingOpen] = useState(true);
  const [emptyDismissed, setEmptyDismissed] = useState(() => isEmptyNoticeDismissed());
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const toggleRanking = useCallback(() => setRankingOpen((v) => !v), []);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  // ---- 모바일 크롬 (플로팅 앱바 + 바텀시트) ----
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // memo된 DrawingPanel이 팬/줌 리렌더에 휩쓸리지 않도록 identity 고정
  const minimap = useMemo(
    () =>
      meta
        ? { url: `/api/tiles/0/0/0?v=${meta.version}`, sizeRatio: MAX_LONG / meta.width }
        : undefined,
    [meta],
  );
  const [foundAnim, setFoundAnim] = useState<FoundAnim | null>(null);
  const [missRipple, setMissRipple] = useState<{ sx: number; sy: number } | null>(null);
  const foundT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finding = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pad = useDrawPad();
  const padRef = useRef(pad);
  padRef.current = pad;

  const showToast = useCallback((msg: string) => {
    if (toastT.current) clearTimeout(toastT.current);
    setToast(msg);
    toastT.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const placingRef = useRef(placing);
  placingRef.current = placing;

  /** 서버 상태 동기화: canvas 메타(version → 타일 무효화) + 미발견 목록. 조회된 version 반환 */
  const refreshState = useCallback(async (): Promise<number | null> => {
    try {
      const [c, list] = await Promise.all([
        // version 폴링은 항상 신선해야 함 — 중간 캐시가 옛 version을 주면 갱신을 놓친다
        fetch("/api/canvas", { cache: "no-store" }).then((r) => r.json()) as Promise<CanvasMeta>,
        fetch("/api/drawings", { headers: { "x-device-id": getDeviceId() } }).then((r) =>
          r.ok ? r.json() : [],
        ) as Promise<DrawingItem[]>,
      ]);
      setMeta((prev) => (prev && prev.version === c.version ? prev : c));
      setDrawings(list);
      return c.version;
    } catch (e) {
      console.error("state refresh failed:", e);
      return null;
    }
  }, []);

  /** 발견 직후: 서버가 응답 후 백그라운드로 타일을 재합성하므로,
   * version이 바뀔 때까지 짧게 재조회해 타일에서 그림이 지워지는 시점을 따라잡는다 */
  const refreshUntilNewVersion = useCallback(async () => {
    const prev = metaRef.current?.version ?? null;
    for (let i = 0; i < 10; i++) {
      const v = await refreshState();
      if (v !== null && v !== prev) return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, [refreshState]);

  // 탭(팬이 아닌 클릭): 찾기 판정
  const handleTap = useCallback(
    async (clientX: number, clientY: number) => {
      if (placingRef.current || finding.current) return;

      finding.current = true;
      try {
        const w = viewportRef.current.screenToWorld(clientX, clientY);
        const res = await fetch("/api/find", {
          method: "POST",
          headers: { "content-type": "application/json", "x-device-id": getDeviceId() },
          body: JSON.stringify({ x: Math.round(w.x), y: Math.round(w.y) }),
        });
        if (res.status === 429) {
          showToast(tRef.current.tooFast);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          found: boolean;
          nickname?: string;
          hiddenMs?: number;
        };
        if (data.found) {
          setFoundAnim({
            sx: clientX,
            sy: clientY,
            nickname: data.nickname ?? "",
            hiddenMs: data.hiddenMs ?? 0,
          });
          if (foundT.current) clearTimeout(foundT.current);
          foundT.current = setTimeout(() => setFoundAnim(null), 2200);
          void refreshUntilNewVersion(); // 타일에서 그림 제거 + 목록/배지 갱신 (재합성 완료까지 추적)
        } else {
          setMissRipple({ sx: clientX, sy: clientY });
          if (missT.current) clearTimeout(missT.current);
          missT.current = setTimeout(() => setMissRipple(null), 650);
        }
      } catch (e) {
        console.error("find failed:", e);
      } finally {
        finding.current = false;
      }
    },
    [showToast, refreshUntilNewVersion],
  );

  const viewport = useViewport(meta, { onTap: handleTap });

  // 최초 로드 + 30초 폴링
  useEffect(() => {
    void refreshState();
    const t = setInterval(() => void refreshState(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshState]);

  // ---- 풀스크린 (시안 이식) ----
  const toggleFs = useCallback(() => {
    const next = !fs;
    setFs(next);
    try {
      if (next && rootRef.current?.requestFullscreen) rootRef.current.requestFullscreen();
      else if (!next && document.fullscreenElement) document.exitFullscreen();
    } catch {
      /* Safari 등에서 실패해도 UI 상태는 유지 */
    }
  }, [fs]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFs(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => () => {
    if (toastT.current) clearTimeout(toastT.current);
  }, []);

  const metaRef = useRef(meta);
  metaRef.current = meta;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // 배치 단계 진입 시 모바일 시트류 닫기 (업로드 검증 성공 후에만 닫혀야 하므로 여기서 처리)
  useEffect(() => {
    if (placing) {
      setDrawerOpen(false);
      setSheetOpen(false);
    }
  }, [placing]);

  // Upload → 그림의 원본 크기를 재고 화면 중앙에 배치 미리보기 생성 (STEP 2 진입)
  const onUpload = useCallback(() => {
    const png = padRef.current.exportPng();
    const m = metaRef.current;
    if (!png || !m) {
      showToast(tRef.current.drawFirst);
      return;
    }
    const im = new Image();
    im.onload = () => {
      // 업로드 버튼 시점 사전 검증 — 서버와 같은 기준(알파>ALPHA_VISIBLE)으로 잉크량·실제 크기를 검사해
      // 배치 단계까지 갔다가 제출에서 거절당하는 헛걸음을 막는다 (서버 검증은 그대로 유지)
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth;
      cv.height = im.naturalHeight;
      const c2 = cv.getContext("2d");
      if (!c2) return;
      c2.drawImage(im, 0, 0);
      const px = c2.getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0, minX = cv.width, minY = cv.height, maxX = -1, maxY = -1;
      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          if (px[(y * cv.width + x) * 4 + 3] > ALPHA_VISIBLE) {
            ink++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) {
        showToast(tRef.current.drawFirst);
        return;
      }

      // 잉크 영역만 잘라 정사각 캔버스 중앙에 배치 — 배치 프레임(정사각)에 왜곡 없이 들어간다
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const side = Math.max(bw, bh);
      const sq = document.createElement("canvas");
      sq.width = side;
      sq.height = side;
      const sqc = sq.getContext("2d");
      if (!sqc) return;
      sqc.drawImage(cv, minX, minY, bw, bh, Math.round((side - bw) / 2), Math.round((side - bh) / 2), bw, bh);
      const squareUrl = sq.toDataURL("image/png");

      // WYSIWYG: 패드 전체 = 캔버스의 MAX_LONG. 패드에 그린 비율 그대로 캔버스 크기가 된다
      // (im.naturalWidth = 패드 버퍼 크기(정사각) → 잉크 긴 변 × (MAX_LONG/패드) = 월드 크기)
      // 최소 미달이면 확대하지 않고 반려 — 점 하나가 뻥튀기되어 올라가는 것을 막는다
      const rawWorld = side * (MAX_LONG / im.naturalWidth);
      if (rawWorld < MIN_LONG) {
        showToast(tRef.current.tooSmall);
        return;
      }
      const sideWorld = Math.round(Math.min(MAX_LONG, rawWorld));
      const w = sideWorld;
      const h = sideWorld;
      const aspect = 1;
      // 월드 스케일: 정사각 export가 w×h로 배치되므로 균일 배율
      const scale = w / side;
      if (ink * scale * scale < MIN_INK_WORLD) {
        showToast(tRef.current.tooFaint);
        return;
      }

      const c = viewportRef.current.centerWorld();
      const p = clampToCanvas(
        { img: squareUrl, x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h, aspect },
        m,
      );
      setNickname(getLastNickname() || "Anonymous");
      setPlacing(p);
      // 100% 줌으로 이동 (1 월드px = 1 화면px) — 그림판에서 그린 크기 그대로 미리보기가 보인다
      viewportRef.current.centerOn(p.x + p.w / 2, p.y + p.h / 2, 1);
    };
    im.src = png;
  }, [showToast]);

  const onMove = useCallback((x: number, y: number) => {
    setPlacing((p) => (p && metaRef.current ? clampToCanvas({ ...p, x, y }, metaRef.current) : p));
  }, []);

  const onResize = useCallback((long: number) => {
    setPlacing((p) => {
      if (!p || !metaRef.current) return p;
      const { w, h } = sizeFromLong(long, p.aspect);
      return clampToCanvas({ ...p, w, h }, metaRef.current);
    });
  }, []);

  const onCancelPlace = useCallback(() => {
    setPlacing(null);
    setSubmitting(false);
  }, []);

  const onCompletePlace = useCallback(async () => {
    const p = placing;
    const nick = nickname.trim();
    if (!p || !nick) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/drawings", {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({ nickname: nick, imageDataUrl: p.img, x: p.x, y: p.y, w: p.w, h: p.h }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        showToast(tRef.current.uploadFailed(msg || String(res.status)));
        setSubmitting(false);
        return;
      }
      saveNickname(nick);
      // 저장 완료 → 즉시 성공 피드백. 서버는 응답 후 백그라운드로 타일을 재합성하므로
      // 목록은 바로 갱신하고, 타일 무효화(version)는 폴링으로 따라잡는다.
      setPlacing(null);
      setSubmitting(false);
      padRef.current.reset();
      showToast(tRef.current.hideSuccess);
      refreshUntilNewVersion();
    } catch (e) {
      showToast(tRef.current.networkError);
      setSubmitting(false);
    }
  }, [placing, nickname, showToast, refreshUntilNewVersion]);

  return (
    <div
      ref={rootRef}
      className="hc"
      data-theme={theme}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-inter), Inter, -apple-system, 'Segoe UI', sans-serif",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {meta ? (
        <CanvasViewport meta={meta} viewport={viewport} topInset={fs || isMobile ? 0 : 56}>
          {placing && (
            <PlacementOverlay placing={placing} scale={viewport.view.s} onMove={onMove} />
          )}
        </CanvasViewport>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--text2)",
            fontSize: 13,
          }}
        >
          캔버스 불러오는 중…
        </div>
      )}

      {/* ===== 탑 네비게이션 (데스크톱) / 플로팅 앱바 (모바일) ===== */}
      {isMobile && <MobileAppBar remain={meta?.remainCount ?? 0} onHelp={() => setHelpOpen(true)} />}
      {!isMobile && (
      <nav
        data-screen-label="Top Navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "var(--surface)",
          backdropFilter: "blur(10px) saturate(1.5)",
          WebkitBackdropFilter: "blur(10px) saturate(1.5)",
          borderBottom: "1px solid var(--line)",
          transform: fs ? "translateY(-72px)" : "translateY(0)",
          transition: "transform .45s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em" }}>Draw & Seek</div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text2)",
              marginLeft: 4,
              padding: "3px 8px",
              border: "1px solid var(--line)",
              borderRadius: 999,
            }}
          >
            {t.remainCount(meta?.remainCount ?? 0)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          className="icon-btn"
          onClick={() => setHelpOpen(true)}
          title={t.helpButton}
          style={{ width: 32, height: 32 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
        </div>
      </nav>
      )}

      {/* ===== 도움말 모달 ===== */}
      <HelpModal open={helpOpen} onClose={closeHelp} />

      {/* ===== 플로팅 컨트롤 (모바일: 하단 필 위로) ===== */}
      <div
        data-screen-label="Floating Controls"
        className="float-stack"
        style={{
          position: "fixed",
          right: isMobile ? 12 : 16,
          bottom: isMobile ? "calc(72px + env(safe-area-inset-bottom))" : 16,
          zIndex: 37,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button className="float-btn" onClick={viewport.zoomIn} title="Zoom In" style={{ fontSize: 18 }}>
          ＋
        </button>
        <button className="float-btn" onClick={viewport.zoomOut} title="Zoom Out" style={{ fontSize: 18 }}>
          －
        </button>
        <button className="float-btn" onClick={viewport.resetView} title="Reset View" style={{ fontSize: 16 }}>
          ⟲
        </button>
        {!isMobile && (
          <button className="float-btn" onClick={toggleFs} title="Fullscreen" style={{ fontSize: 16 }}>
            ⛶
          </button>
        )}
      </div>

      {/* ===== 사이드바: 데스크톱은 풀스크린만 숨김, 모바일은 축소판(배치 중 숨김) ===== */}
      {!isMobile && <Sidebar items={drawings} hidden={fs} />}
      {isMobile && <Sidebar items={drawings} hidden={!!placing} compact />}
      {!isMobile && (
        <RankingPanel items={drawings} hidden={fs || !!placing} open={rankingOpen} onToggle={toggleRanking} />
      )}

      {/* ===== 모바일: 하단 액션 필 + 랭킹 시트 + 그리기 드로어 ===== */}
      {isMobile && !placing && (
        <MobileActionPills
          onOpenSheet={() => {
            setSheetOpen(true);
            setDrawerOpen(false);
          }}
          onOpenDrawer={() => {
            setDrawerOpen(true);
            setSheetOpen(false);
          }}
        />
      )}
      {isMobile && <MobileSheet items={drawings} open={sheetOpen} onClose={() => setSheetOpen(false)} />}
      {isMobile && (
        <MobileDrawingDrawer pad={pad} open={drawerOpen && !placing} onClose={() => setDrawerOpen(false)} onUpload={onUpload} />
      )}

      {/* ===== 발견/미스 애니메이션 ===== */}
      {foundAnim && <FoundAnimation anim={foundAnim} />}
      {missRipple && <MissRipple sx={missRipple.sx} sy={missRipple.sy} />}

      {/* ===== 빈 상태 ===== */}
      {meta && meta.remainCount === 0 && drawings.length === 0 && !placing && !emptyDismissed && (
        <div style={{ position: "fixed", inset: 0, zIndex: 33, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div
            style={{
              pointerEvents: "auto",
              position: "relative",
              background: "var(--surface)",
              backdropFilter: "blur(10px) saturate(1.5)",
              WebkitBackdropFilter: "blur(10px) saturate(1.5)",
              border: "1px solid var(--line)",
              borderRadius: 20,
              boxShadow: "var(--shadow)",
              padding: "32px 38px",
              textAlign: "center",
              animation: "popIn .45s cubic-bezier(.3,1.3,.5,1) both",
            }}
          >
            <button
              className="icon-btn"
              onClick={() => {
                setEmptyDismissed(true);
                dismissEmptyNotice();
              }}
              title={t.close}
              style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, fontSize: 14 }}
            >
              ✕
            </button>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
                fontSize: 30,
              }}
            >
              🔍
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 5 }}>
              {t.emptyTitle}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)" }}>{t.emptyDesc}</div>
          </div>
        </div>
      )}

      {/* ===== 배치 스테퍼 (STEP 2) ===== */}
      {placing && (
        <PlacementStepper
          placing={placing}
          nickname={nickname}
          onNickname={setNickname}
          onResize={onResize}
          onComplete={onCompletePlace}
          onCancel={onCancelPlace}
          submitting={submitting}
        />
      )}

      {/* ===== 그림판 (데스크톱 — 풀스크린·배치 중에는 숨김) ===== */}
      {!isMobile && !fs && !placing && (
        <DrawingPanel
          pad={pad}
          open={panelOpen}
          onToggle={togglePanel}
          onUpload={onUpload}
          minimap={minimap}
        />
      )}

      {/* ===== 토스트 ===== */}
      {toast && (
        <div
          style={{
            position: "fixed",
            // 모바일은 시트/드로어에 가리지 않게 상단, 데스크톱은 그림판 위
            top: isMobile ? "calc(70px + env(safe-area-inset-top))" : undefined,
            bottom: isMobile ? undefined : panelOpen && !fs ? 282 : 72,
            left: "50%",
            zIndex: 65,
            background: "var(--surface)",
            backdropFilter: "blur(16px) saturate(1.6)",
            WebkitBackdropFilter: "blur(16px) saturate(1.6)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            boxShadow: "var(--shadow)",
            animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

    </div>
  );
}
