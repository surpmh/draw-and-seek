import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * 역대 히스토리 — 숨어있는 그림 + 발견된 그림 전체를 "숨어 있(었)던 시간" 순으로.
 * 좌표는 포함하지 않는다.
 */
export async function GET() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("drawings")
    .select("id, nickname, created_at, found_at")
    .is("removed_at", null) // 관리자 제재 그림은 기록에서도 제외
    .limit(1000);
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const now = Date.now();
  const list = (data ?? [])
    .map((d) => {
      const found = d.found_at != null;
      const end = found ? new Date(d.found_at as string).getTime() : now;
      return {
        id: d.id,
        nickname: d.nickname,
        found,
        hiddenAt: d.created_at,
        foundAt: (d.found_at as string | null) ?? null,
        survivedMs: end - new Date(d.created_at).getTime(),
        thumbnailUrl: `/api/drawings/${d.id}/thumb`,
      };
    })
    .sort((a, b) => b.survivedMs - a.survivedMs)
    .slice(0, 100);

  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}
