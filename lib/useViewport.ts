"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasMeta, View } from "./tiles";

const S_MAX = 3;
const ANIM_MS = 540;
/** 제스처 중 상태(setState) 커밋 주기 — transform은 매 프레임 DOM에 직접 쓰고,
 * 리렌더가 필요한 타일 갱신만 이 간격으로 묶는다 (모바일에서 매 프레임 리렌더는 fps를 깎는다) */
const TILE_COMMIT_MS = 150;

export interface ViewportSize {
  w: number;
  h: number;
}

/**
 * 시안(Hidden Canvas.dc.html)의 팬/줌 로직 이식:
 * view = { x, y, s } — 월드 → 스크린 변환: screen = world * s + (x, y)
 */
export interface ViewportOptions {
  /** 팬이 아닌 클릭(탭) 시 호출 — 스포이드 색추출·찾기 판정에 사용 */
  onTap?: (clientX: number, clientY: number) => void;
}

export function useViewport(meta: CanvasMeta | null, options: ViewportOptions = {}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, s: 0.2 });
  const [size, setSize] = useState<ViewportSize>({ w: 0, h: 0 });
  const [panning, setPanning] = useState(false);
  const [animating, setAnimating] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; cx: number; cy: number } | null>(null);
  /** 활성 포인터 위치 (멀티터치) — 두 개가 되면 핀치 줌으로 전환 */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null);
  const onTapRef = useRef(options.onTap);
  onTapRef.current = options.onTap;
  /** 팬 직후의 클릭을 무시하기 위한 플래그 (M3의 찾기 판정에서 사용) */
  const suppressClick = useRef(false);
  const fitted = useRef(false);
  const animT = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 고빈도 입력(팬·휠)을 프레임당 1회 상태 커밋으로 합치기 위한 버퍼 */
  const pendingView = useRef<View | null>(null);
  const rafId = useRef<number | null>(null);
  /** 변환 대상 엘리먼트 — 제스처 중엔 React를 우회해 여기에 transform을 직접 쓴다 */
  const transformRef = useRef<HTMLDivElement | null>(null);
  /** DOM에 마지막으로 반영된 뷰 — 상태 커밋과 렌더 사이의 공백에서 latestView의 기준 */
  const lastApplied = useRef<View | null>(null);
  const lastStateCommit = useRef(0);
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minScale = useCallback(() => {
    const m = metaRef.current;
    const el = elRef.current;
    if (!m || !el || !el.clientWidth) return 0.02;
    // 이미지가 화면을 가득 덮는 배율(cover)이 최소 줌 — 어느 축에도 여백이 생기지 않는다
    return Math.max(el.clientWidth / m.width, el.clientHeight / m.height);
  }, []);

  const clampS = useCallback((s: number) => Math.min(S_MAX, Math.max(minScale(), s)), [minScale]);

  /** 이미지 밖(배경)이 뷰포트에 들어오지 않도록 x/y를 제한 */
  const clampXY = useCallback((v: View): View => {
    const m = metaRef.current;
    const el = elRef.current;
    if (!m || !el || !el.clientWidth) return v;
    // 이미지가 화면 축보다 작으면(contain 축소 상태) 그 축은 중앙 정렬로 고정
    const axis = (viewLen: number, contentLen: number, pos: number) =>
      contentLen <= viewLen
        ? (viewLen - contentLen) / 2
        : Math.min(0, Math.max(viewLen - contentLen, pos));
    return {
      x: axis(el.clientWidth, m.width * v.s, v.x),
      y: axis(el.clientHeight, m.height * v.s, v.y),
      s: v.s,
    };
  }, []);

  const applyTransform = useCallback((v: View) => {
    lastApplied.current = v;
    const el = transformRef.current;
    if (el) el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
  }, []);

  /** pending으로 남아 있는 뷰를 상태로 커밋 — 제스처 종료·트레일링 시점에 호출 */
  const flushView = useCallback(() => {
    if (flushT.current) {
      clearTimeout(flushT.current);
      flushT.current = null;
    }
    const pv = pendingView.current;
    if (pv) {
      pendingView.current = null;
      lastStateCommit.current = performance.now();
      setViewState(pv);
    }
  }, []);

  /** 고빈도 입력(팬·핀치·휠): transform은 매 rAF 프레임 DOM에 직접 반영하고(60fps),
   * 타일 갱신용 상태 커밋은 TILE_COMMIT_MS 간격으로만 — 트리 리렌더가 제스처를 못 따라오는 문제 방지 */
  const commitView = useCallback(
    (v: View) => {
      pendingView.current = v;
      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          const pv = pendingView.current;
          if (!pv) return;
          applyTransform(pv);
          if (performance.now() - lastStateCommit.current >= TILE_COMMIT_MS) {
            flushView();
          } else {
            // 휠처럼 end 이벤트가 없는 입력도 멈추면 최종 뷰가 상태에 반영되도록
            if (flushT.current) clearTimeout(flushT.current);
            flushT.current = setTimeout(flushView, TILE_COMMIT_MS);
          }
        });
      }
    },
    [applyTransform, flushView],
  );

  /** 누적 계산의 기준 뷰 — 아직 커밋 안 된 pending → DOM 반영값 → 상태 순 */
  const latestView = useCallback(() => pendingView.current ?? lastApplied.current ?? viewRef.current, []);

  const setView = useCallback(
    (x: number, y: number, s: number, anim: boolean) => {
      pendingView.current = null; // 저빈도 경로(버튼·fit)는 즉시 커밋이 우선
      if (flushT.current) {
        clearTimeout(flushT.current);
        flushT.current = null;
      }
      const nv = clampXY({ x, y, s });
      lastApplied.current = nv;
      setViewState(nv);
      if (anim) {
        setAnimating(true);
        if (animT.current) clearTimeout(animT.current);
        animT.current = setTimeout(() => setAnimating(false), ANIM_MS);
      } else {
        setAnimating(false);
      }
    },
    [clampXY],
  );

  const fitView = useCallback(
    (anim: boolean) => {
      const m = metaRef.current;
      const el = elRef.current;
      if (!m || !el || !el.clientWidth) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      // 기본 뷰 = 화면을 가득 채우는 배율 (cover fit) — 여백 없음
      const s = clampS(Math.max(vw / m.width, vh / m.height));
      setView((vw - m.width * s) / 2, (vh - m.height * s) / 2, s, anim);
    },
    [clampS, setView],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, f: number, anim: boolean) => {
      const el = elRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = cx - r.left;
      const py = cy - r.top;
      // 휠은 프레임당 여러 번 올 수 있어 pending 기준으로 누적
      const { x, y, s } = anim ? viewRef.current : latestView();
      const ns = clampS(s * f);
      const k = ns / s;
      const next = { x: px - (px - x) * k, y: py - (py - y) * k, s: ns };
      if (anim) setView(next.x, next.y, next.s, true);
      else commitView(clampXY(next));
    },
    [clampS, setView, clampXY, commitView, latestView],
  );

  const zoomCenter = useCallback(
    (f: number) => {
      const el = elRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      zoomAt(r.left + el.clientWidth / 2, r.top + el.clientHeight / 2, f, true);
    },
    [zoomAt],
  );

  const centerOn = useCallback(
    (wx: number, wy: number, s: number) => {
      const el = elRef.current;
      if (!el) return;
      const ns = clampS(s);
      setView(el.clientWidth / 2 - wx * ns, el.clientHeight / 2 - wy * ns, ns, true);
    },
    [clampS, setView],
  );

  /** 현재 뷰포트 중앙의 월드 좌표 */
  const centerWorld = useCallback(() => {
    const el = elRef.current;
    const { x, y, s } = viewRef.current;
    const vw = el?.clientWidth ?? 0;
    const vh = el?.clientHeight ?? 0;
    return { x: (vw / 2 - x) / s, y: (vh / 2 - y) / s };
  }, []);

  const screenToWorld = useCallback((cx: number, cy: number) => {
    const el = elRef.current;
    const { x, y, s } = viewRef.current;
    const r = el?.getBoundingClientRect();
    return {
      x: (cx - (r?.left ?? 0) - x) / s,
      y: (cy - (r?.top ?? 0) - y) / s,
    };
  }, []);

  // 상태 커밋 렌더가 그 사이 DOM에 직접 쓴 더 새로운 transform을 덮어쓸 수 있어,
  // 커밋 직후 최신 제스처 뷰를 재적용한다 (제스처 중이 아니면 값이 같아 no-op)
  useLayoutEffect(() => {
    const pv = pendingView.current ?? lastApplied.current;
    if (pv && (pv.x !== view.x || pv.y !== view.y || pv.s !== view.s)) applyTransform(pv);
  }, [view, applyTransform]);

  // ---- 팬 + 핀치 (pointer) ----
  const panMove = useCallback(
    (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      // 핀치 줌: 시작 시점 뷰를 기준으로 배율과 이동을 함께 계산 (누적 오차 없음)
      const pz = pinch.current;
      if (pz && pointers.current.size >= 2) {
        const el = elRef.current;
        if (!el) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 1) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const r = el.getBoundingClientRect();
        const v = pz.view;
        const ns = clampS(v.s * (dist / pz.dist));
        const k = ns / v.s;
        const px = pz.mid.x - r.left;
        const py = pz.mid.y - r.top;
        commitView(
          clampXY({
            x: px - (px - v.x) * k + (mid.x - pz.mid.x),
            y: py - (py - v.y) * k + (mid.y - pz.mid.y),
            s: ns,
          }),
        );
        return;
      }
      const p = pan.current;
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true;
      commitView(clampXY({ x: p.vx + dx, y: p.vy + dy, s: latestView().s }));
    },
    [clampXY, commitView, latestView, clampS],
  );

  const panEnd = useCallback(
    (e?: PointerEvent) => {
      if (e) pointers.current.delete(e.pointerId);
      // 핀치 종료(손가락 하나만 남음): 남은 손가락은 새 제스처로 취급하지 않는다
      if (pinch.current && pointers.current.size < 2) {
        pinch.current = null;
        pan.current = null;
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 80);
      }
      if (e && pointers.current.size > 0) return; // 아직 손가락이 남음 — 리스너 유지
      const p = pan.current;
      if (p?.moved) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 80);
      } else if (p && !p.moved) {
        // 이동 없는 클릭 = 탭 → 색추출/찾기 판정
        const cx = e?.clientX ?? p.cx;
        const cy = e?.clientY ?? p.cy;
        onTapRef.current?.(cx, cy);
      }
      pan.current = null;
      pointers.current.clear();
      flushView(); // 제스처 종료 — 최종 뷰를 상태로 커밋해 타일을 현재 화면에 맞춘다
      window.removeEventListener("pointermove", panMove);
      window.removeEventListener("pointerup", panEnd);
      window.removeEventListener("pointercancel", panEnd);
      setPanning(false);
    },
    [panMove, flushView],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const first = pointers.current.size === 0;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        // 두 번째 손가락 → 팬 중단, 핀치 시작
        const [a, b] = [...pointers.current.values()];
        pinch.current = {
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          view: latestView(),
        };
        pan.current = null;
      } else if (first) {
        const { x, y } = viewRef.current;
        pan.current = { x: e.clientX, y: e.clientY, vx: x, vy: y, moved: false, cx: e.clientX, cy: e.clientY };
        window.addEventListener("pointermove", panMove);
        window.addEventListener("pointerup", panEnd);
        window.addEventListener("pointercancel", panEnd);
      }
      setPanning(true);
      setAnimating(false);
    },
    [panMove, panEnd, latestView],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => zoomAt(e.clientX, e.clientY, 1.7, true),
    [zoomAt],
  );

  // ---- 휠 줌 (non-passive) ----
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      zoomAt(e.clientX, e.clientY, f, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, meta]);

  // ---- 뷰포트 크기 추적 + 최초 fit ----
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      if (!fitted.current && metaRef.current && el.clientWidth) {
        fitted.current = true;
        fitView(false);
      } else {
        // 창 크기 변경 시에도 빈 공간이 생기지 않도록 재클램프
        setViewState((v) => clampXY({ ...v, s: Math.min(S_MAX, Math.max(minScale(), v.s)) }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView, meta, clampXY, minScale]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", panMove);
      window.removeEventListener("pointerup", panEnd);
      window.removeEventListener("pointercancel", panEnd);
      if (animT.current) clearTimeout(animT.current);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (flushT.current) clearTimeout(flushT.current);
    };
  }, [panMove, panEnd]);

  return {
    elRef,
    transformRef,
    view,
    size,
    panning,
    animating,
    suppressClick,
    onPointerDown,
    onDoubleClick,
    zoomIn: () => zoomCenter(1.35),
    zoomOut: () => zoomCenter(1 / 1.35),
    resetView: () => fitView(true),
    centerOn,
    centerWorld,
    screenToWorld,
  };
}

export type Viewport = ReturnType<typeof useViewport>;
