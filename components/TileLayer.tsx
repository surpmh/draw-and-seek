"use client";

import { useReducer, useRef } from "react";
import type { CanvasMeta, TileSpec, View } from "@/lib/tiles";
import { levelForScale, visibleTiles } from "@/lib/tiles";
import type { ViewportSize } from "@/lib/useViewport";

const tileUrl = (z: number, tx: number, ty: number, v: number) =>
  `/api/tiles/${z}/${tx}/${ty}?v=${v}`;

type Placed = TileSpec & { k: string; url: string };

export function TileLayer({
  view,
  size,
  meta,
  gesturing = false,
}: {
  view: View;
  size: ViewportSize;
  meta: CanvasMeta;
  /** 팬/핀치 진행 중 — 줌 레벨을 고정해 제스처 도중 타일 전체 교체를 막는다 */
  gesturing?: boolean;
}) {
  /** 로드 완료된 타일 키 — 이전 세트를 언제 내려도 되는지 판단 */
  const loaded = useRef<Set<string>>(new Set());
  /** 마지막으로 전부 로드됐던 타일 세트 — 레벨/버전 교체 중 저해상도로 튀지 않게 밑에 깔아둔다 */
  const stable = useRef<Placed[]>([]);
  const frozenZ = useRef<number | null>(null);
  const [, bump] = useReducer((c: number) => c + 1, 0);

  if (!size.w) return null;
  const v = meta.version;

  // 제스처 중엔 시작 시점 레벨 유지(줌아웃은 한 단계까지만 — 고정 레벨 타일 수 폭증 방지).
  // 레벨 교체는 손을 뗀 뒤 한 번만 일어난다.
  const natural = levelForScale(view.s, meta.maxZoom);
  let z = natural;
  if (gesturing && frozenZ.current !== null) {
    z = Math.min(meta.maxZoom, frozenZ.current, natural + 1);
  } else {
    frozenZ.current = natural;
  }

  const tiles: Placed[] = visibleTiles(view, size.w, size.h, meta, z).map((t) => ({
    ...t,
    k: `${t.z}/${t.tx}/${t.ty}/${v}`,
    url: tileUrl(t.z, t.tx, t.ty, v),
  }));
  const allLoaded = tiles.every((t) => loaded.current.has(t.k));
  if (allLoaded) {
    stable.current = tiles;
    if (loaded.current.size > 800) loaded.current = new Set(tiles.map((t) => t.k));
  }
  const curKeys = new Set(tiles.map((t) => t.k));
  const underlay = allLoaded ? [] : stable.current.filter((t) => !curKeys.has(t.k));

  const onLoad = (k: string) => {
    loaded.current.add(k);
    // 현재 세트가 전부 로드된 순간 한 번만 리렌더해 underlay를 내린다
    if (underlay.length && tiles.every((t) => loaded.current.has(t.k))) bump();
  };

  return (
    <>
      {/* 최저해상도 백드롭: 고해상도 타일 로딩 중 빈 화면 방지 */}
      <img
        src={tileUrl(0, 0, 0, v)}
        alt=""
        draggable={false}
        onLoad={() => onLoad(`0/0/0/${v}`)}
        style={{ position: "absolute", left: 0, top: 0, width: meta.width, height: meta.height, pointerEvents: "none" }}
      />
      {/* 새 타일 로딩 중엔 직전 세트를 밑에 유지 — 레벨/버전 교체 때 흐릿해지지 않게 */}
      {underlay.map(
        (t) =>
          t.z !== 0 && (
            <img
              key={`u:${t.k}`}
              src={t.url}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: t.left, top: t.top, width: t.w, height: t.h, pointerEvents: "none" }}
            />
          ),
      )}
      {z !== 0 &&
        tiles.map((t) => (
          <img
            key={t.k}
            src={t.url}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={() => onLoad(t.k)}
            style={{ position: "absolute", left: t.left, top: t.top, width: t.w, height: t.h, pointerEvents: "none" }}
          />
        ))}
    </>
  );
}
