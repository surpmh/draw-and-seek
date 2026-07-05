"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Tool = "pen" | "eraser" | "fill";

const MAX_HISTORY = 30;
/** 지우개 실제 굵기 = brush × 이 배율 (커서 표시에도 사용) */
export const ERASER_SCALE = 2.4;
/** 플러드 필 색 판정 허용 오차 (채널당) — 안티앨리어싱 경계 흡수 */
const FILL_TOL = 40;
/** 투명 영역 채우기에서 경계로 취급할 최소 알파 — 이보다 옅은 픽셀만 통과 가능. 낮게 잡아 사실상 닫혀 보이는(0px) 틈으로 새지 않게 한다 */
const FILL_BARRIER = 12;
/** 채운 뒤 경계선 안쪽 안티앨리어싱 프린지 밑으로 확장하는 횟수(px) — 빈 픽셀 없이 딱 붙게 채운다 */
const FILL_GROW = 2;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * 그림판 상태 + 캔버스 드로잉 로직 (시안 이식 + 스포이드 추가).
 * 배경은 항상 투명 — export 시 획만 담긴 PNG가 나온다.
 */
export function useDrawPad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokeRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1b1e23");
  const [brush, setBrush] = useState(6);
  const [strokes, setStrokes] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const brushRef = useRef(brush);
  brushRef.current = brush;

  const setupCanvas = useCallback((el: HTMLCanvasElement) => {
    if (el === canvasRef.current && ctxRef.current) return;
    canvasRef.current = el;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.max(1, Math.round(el.clientWidth * dpr));
    el.height = Math.max(1, Math.round(el.clientHeight * dpr));
    const c = el.getContext("2d");
    if (!c) return;
    c.scale(dpr, dpr);
    c.lineCap = "round";
    c.lineJoin = "round";
    ctxRef.current = c;
  }, []);

  const canvasRefCb = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (el) requestAnimationFrame(() => setupCanvas(el));
    },
    [setupCanvas],
  );

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = ctxRef.current;
    if (!c) return;
    const eraser = toolRef.current === "eraser";
    c.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    c.strokeStyle = colorRef.current;
    c.lineWidth = eraser ? brushRef.current * ERASER_SCALE : brushRef.current;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  };

  const pushHistory = (snapshot?: string) => {
    const el = canvasRef.current;
    if (!el) return;
    historyRef.current.push(snapshot ?? el.toDataURL());
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    redoRef.current = [];
  };

  /** 클릭 지점과 같은 색으로 이어진 영역을 현재 색으로 칠한다 (스캔라인 플러드 필). 변화 없으면 false */
  const floodFill = (cssX: number, cssY: number): boolean => {
    const el = canvasRef.current;
    const c = ctxRef.current;
    if (!el || !c) return false;
    const dpr = el.width / el.clientWidth;
    const sx = Math.round(cssX * dpr);
    const sy = Math.round(cssY * dpr);
    const W = el.width;
    const H = el.height;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return false;

    const img = c.getImageData(0, 0, W, H);
    const d = img.data;
    const si = (sy * W + sx) * 4;
    const [fr, fg, fb] = hexToRgb(colorRef.current);
    const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
    // 시작점이 이미 채우기 색이면 무시
    if (ta === 255 && Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 12) return false;

    // 투명 픽셀은 RGB가 무의미하므로 알파만으로 판정 — 경계는 엄격하게(FILL_BARRIER), 빈 프린지는 아래 확장 단계에서 메운다
    const match = (i: number) => {
      const da = d[i + 3];
      if (ta <= FILL_TOL) return da <= FILL_BARRIER;
      return (
        Math.abs(da - ta) <= FILL_TOL &&
        Math.abs(d[i] - tr) <= FILL_TOL &&
        Math.abs(d[i + 1] - tg) <= FILL_TOL &&
        Math.abs(d[i + 2] - tb) <= FILL_TOL
      );
    };

    const visited = new Uint8Array(W * H);
    let painted = 0;
    const canFill = (x: number, y: number) => !visited[y * W + x] && match((y * W + x) * 4);
    const paint = (x: number, y: number) => {
      const p = y * W + x;
      visited[p] = 1;
      painted++;
      d[p * 4] = fr;
      d[p * 4 + 1] = fg;
      d[p * 4 + 2] = fb;
      d[p * 4 + 3] = 255;
    };

    const stack = [sy * W + sx];
    while (stack.length) {
      const p = stack.pop()!;
      const y = Math.floor(p / W);
      let x = p % W;
      while (x > 0 && canFill(x - 1, y)) x--;
      let above = false;
      let below = false;
      while (x < W && canFill(x, y)) {
        paint(x, y);
        if (y > 0) {
          if (canFill(x, y - 1)) {
            if (!above) {
              stack.push((y - 1) * W + x);
              above = true;
            }
          } else above = false;
        }
        if (y < H - 1) {
          if (canFill(x, y + 1)) {
            if (!below) {
              stack.push((y + 1) * W + x);
              below = true;
            }
          } else below = false;
        }
        x++;
      }
    }

    if (!painted) return false;

    // 채운 영역을 경계선의 안티앨리어싱 프린지 '밑'으로 확장 — 기존 픽셀을 채우기 색 위에 얹는 식으로
    // 합성해서(src over fill) 경계선과 채운 영역 사이에 빈 픽셀이 남지 않게 한다
    for (let round = 0; round < FILL_GROW; round++) {
      const grow: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (visited[p] || d[p * 4 + 3] === 255) continue;
          if (
            (x > 0 && visited[p - 1]) ||
            (x < W - 1 && visited[p + 1]) ||
            (y > 0 && visited[p - W]) ||
            (y < H - 1 && visited[p + W])
          ) {
            grow.push(p);
          }
        }
      }
      for (const p of grow) {
        const i = p * 4;
        const a = d[i + 3] / 255;
        d[i] = Math.round(d[i] * a + fr * (1 - a));
        d[i + 1] = Math.round(d[i + 1] * a + fg * (1 - a));
        d[i + 2] = Math.round(d[i + 2] * a + fb * (1 - a));
        d[i + 3] = 255;
        visited[p] = 1;
      }
    }

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.putImageData(img, 0, 0);
    c.restore();
    return true;
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!ctxRef.current) return;
    e.stopPropagation();

    if (toolRef.current === "fill") {
      const el = canvasRef.current;
      if (!el) return;
      const before = el.toDataURL();
      const p = point(e);
      if (!floodFill(p.x, p.y)) return; // 변화 없으면 히스토리도 남기지 않음
      pushHistory(before);
      setStrokes((n) => n + 1);
      setCanUndo(true);
      setCanRedo(false);
      return;
    }

    canvasRef.current?.setPointerCapture(e.pointerId);
    pushHistory();
    const p = point(e);
    strokeRef.current = p;
    drawSeg(p, { x: p.x + 0.01, y: p.y + 0.01 });
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!strokeRef.current) return;
    const p = point(e);
    drawSeg(strokeRef.current, p);
    strokeRef.current = p;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!strokeRef.current) return;
    strokeRef.current = null;
    setStrokes((n) => n + 1);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const restore = (url: string | undefined) => {
    const c = ctxRef.current;
    const el = canvasRef.current;
    if (!c || !el) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, el.width, el.height);
    c.restore();
    if (url) {
      const im = new Image();
      im.onload = () => {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        // 지우개 사용 후엔 destination-out이 남아 있어 스냅샷이 그려지지 않는다 (undo가 전부 지우는 버그)
        c.globalCompositeOperation = "source-over";
        c.drawImage(im, 0, 0);
        c.restore();
      };
      im.src = url;
    }
  };

  const undo = useCallback(() => {
    const el = canvasRef.current;
    if (!historyRef.current.length || !el) return;
    redoRef.current.push(el.toDataURL());
    restore(historyRef.current.pop());
    setStrokes(historyRef.current.length);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const el = canvasRef.current;
    if (!redoRef.current.length || !el) return;
    historyRef.current.push(el.toDataURL());
    restore(redoRef.current.pop());
    setStrokes(historyRef.current.length);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const clear = useCallback(() => {
    const el = canvasRef.current;
    const c = ctxRef.current;
    if (!el || !c) return;
    pushHistory();
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, el.width, el.height);
    c.restore();
    setStrokes(0);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const reset = useCallback(() => {
    const el = canvasRef.current;
    const c = ctxRef.current;
    if (el && c) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, el.width, el.height);
      c.restore();
    }
    historyRef.current = [];
    redoRef.current = [];
    setStrokes(0);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  /** 투명 배경 PNG로 export (획만 포함). 비어 있으면 null */
  const exportPng = useCallback((): string | null => {
    const el = canvasRef.current;
    if (!el || strokesEmpty()) return null;
    return el.toDataURL("image/png");
  }, []);

  const strokesEmpty = () => strokes <= 0 && historyRef.current.length === 0;

  useEffect(() => {
    return () => {
      historyRef.current = [];
      redoRef.current = [];
    };
  }, []);

  // 객체 identity를 상태 값에만 묶는다 — 뷰포트 팬/줌 리렌더 때
  // DrawingPanel(React.memo)이 불필요하게 다시 그려지지 않도록.
  return useMemo(
    () => ({
      canvasRefCb,
      tool,
      setTool,
      color,
      setColor,
      brush,
      setBrush,
      strokes,
      canUndo,
      canRedo,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      undo,
      redo,
      clear,
      reset,
      exportPng,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, brush, strokes, canUndo, canRedo],
  );
}

export type DrawPad = ReturnType<typeof useDrawPad>;
