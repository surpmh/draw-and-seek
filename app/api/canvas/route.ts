import { NextResponse } from "next/server";
import { readTilesetMeta, readCanvasStatus } from "@/lib/canvas-meta";

export async function GET() {
  const meta = await readTilesetMeta();
  const { version, remainCount } = await readCanvasStatus();
  // 전역 공유 엔드포인트(쿼리 없음) → 한 요청이 캐시를 데우면 모두가 엣지에서 즉답.
  // version은 그리기/찾기 시 오르지만, 짧은 s-maxage + SWR로 폴링(1.5s 간격)이
  // 새 version을 ~1~2s 내 따라잡으면서도 콜드스타트(≈1s) 왕복은 대부분 제거된다.
  return NextResponse.json(
    { ...meta, version, remainCount },
    { headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=10" } },
  );
}
