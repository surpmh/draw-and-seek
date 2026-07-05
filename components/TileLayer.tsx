"use client";

import type { CanvasMeta, View } from "@/lib/tiles";
import { visibleTiles } from "@/lib/tiles";
import type { ViewportSize } from "@/lib/useViewport";

const tileUrl = (z: number, tx: number, ty: number, v: number) =>
  `/api/tiles/${z}/${tx}/${ty}?v=${v}`;

export function TileLayer({
  view,
  size,
  meta,
}: {
  view: View;
  size: ViewportSize;
  meta: CanvasMeta;
}) {
  if (!size.w) return null;
  const tiles = visibleTiles(view, size.w, size.h, meta);
  const v = meta.version;
  const z = tiles[0]?.z;

  return (
    <>
      {/* 최저해상도 백드롭: 고해상도 타일 로딩 중 빈 화면 방지 */}
      <img
        src={tileUrl(0, 0, 0, v)}
        alt=""
        draggable={false}
        style={{ position: "absolute", left: 0, top: 0, width: meta.width, height: meta.height }}
      />
      {z !== 0 &&
        tiles.map((t) => (
          <img
            key={`${t.z}/${t.tx}/${t.ty}/${v}`}
            src={tileUrl(t.z, t.tx, t.ty, v)}
            alt=""
            draggable={false}
            decoding="async"
            style={{ position: "absolute", left: t.left, top: t.top, width: t.w, height: t.h }}
          />
        ))}
    </>
  );
}
