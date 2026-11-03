import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const PAGE_SIZE = 10;
const FILTERS = ["all", "hidden", "found"] as const;

interface Row {
  id: string;
  nickname: string;
  created_at: string;
  found_at: string | null;
  survived_ms: number;
  rank: number;
}

/**
 * 역대 히스토리 — 숨어있는 그림 + 발견된 그림 전체를 "숨어 있(었)던 시간" 순으로, 페이지 단위.
 * 정렬·순위·검색·필터는 DB 함수 history_page가 처리한다. 좌표는 포함하지 않는다.
 * 쿼리: page(1부터), q(닉네임 부분 일치), filter(all|hidden|found)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const q = (sp.get("q") ?? "").trim().slice(0, 50);
  const f = sp.get("filter");
  const filter = FILTERS.includes(f as (typeof FILTERS)[number]) ? f : "all";

  const db = getServiceClient();
  const { data, error } = await db.rpc("history_page", {
    p_query: q,
    p_filter: filter,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const { total, items } = data as { total: number; items: Row[] };
  return NextResponse.json(
    {
      total,
      page,
      pageSize: PAGE_SIZE,
      items: items.map((d) => ({
        id: d.id,
        rank: d.rank,
        nickname: d.nickname,
        found: d.found_at != null,
        hiddenAt: d.created_at,
        foundAt: d.found_at,
        survivedMs: d.survived_ms,
        thumbnailUrl: `/api/drawings/${d.id}/thumb`,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
