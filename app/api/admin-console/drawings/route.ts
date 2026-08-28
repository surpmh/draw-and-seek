import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

const DRAWING_COLUMNS = "id, nickname, device_id, created_at, removed_at, x, y, w, h";

/** 신고함에 한 번에 싣는 그림 수 상한 (신고 많은 순) */
const MAX_REPORTED = 100;

interface DrawingRow {
  id: string;
  nickname: string;
  device_id: string;
  created_at: string;
  removed_at: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

const toItem = (d: DrawingRow, now: number) => ({
  id: d.id,
  nickname: d.nickname,
  deviceId: d.device_id,
  hiddenAt: d.created_at,
  hiddenMs: now - new Date(d.created_at).getTime(),
  removedAt: d.removed_at,
  x: d.x,
  y: d.y,
  w: d.w,
  h: d.h,
});

/**
 * 미처리 신고가 달린 그림 — 신고 수가 많은 순.
 *
 * PostgREST로는 집계 조인이 어려워 신고를 먼저 읽고 코드에서 묶는다. 신고는
 * 처리(삭제 또는 반려)되면 목록에서 빠지므로 미처리 건수 자체가 크게 쌓이지 않는다.
 * 이미 발견된 그림도 포함한다 — 캔버스에서는 내려갔어도 히스토리에 썸네일이 남는다.
 */
async function reportedList(db: ReturnType<typeof getServiceClient>, now: number) {
  const { data: reports, error } = await db
    .from("reports")
    .select("drawing_id, reason, created_at")
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const grouped = new Map<string, { count: number; reasons: Record<string, number>; last: string }>();
  for (const r of reports ?? []) {
    const g = grouped.get(r.drawing_id) ?? { count: 0, reasons: {}, last: r.created_at as string };
    g.count += 1;
    g.reasons[r.reason as string] = (g.reasons[r.reason as string] ?? 0) + 1;
    // created_at 내림차순으로 읽으므로 첫 건이 최신
    if (r.created_at > g.last) g.last = r.created_at as string;
    grouped.set(r.drawing_id, g);
  }
  if (grouped.size === 0) return [];

  // .in()은 id가 전부 URL에 실리므로 상한을 둔다 — 신고가 많은 순으로 잘라 낸다
  const targets = [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .slice(0, MAX_REPORTED);
  if (targets.length < grouped.size) {
    console.warn(`신고 목록 ${grouped.size}건 중 상위 ${MAX_REPORTED}건만 표시합니다`);
  }

  // 이미 삭제된 그림은 '삭제된 그림' 패널이 맡는다
  const { data, error: selErr } = await db
    .from("drawings")
    .select(DRAWING_COLUMNS)
    .in("id", targets.map(([id]) => id))
    .is("removed_at", null);
  if (selErr) throw new Error(selErr.message);

  return (data ?? [])
    .map((d) => {
      const g = grouped.get(d.id)!;
      return { ...toItem(d as DrawingRow, now), reportCount: g.count, reasons: g.reasons, lastReportedAt: g.last };
    })
    .sort((a, b) => b.reportCount - a.reportCount || b.lastReportedAt.localeCompare(a.lastReportedAt));
}

/**
 * 관리자 전용 그림 목록.
 *   ?status=hidden   (기본) — 캔버스에 숨어있는 미발견 그림
 *   ?status=removed         — 관리자가 삭제(제재)한 그림 (복구 대상)
 *   ?status=reported        — 미처리 신고가 달린 그림 (신고 수·사유 포함)
 * 공개 API와 달리 좌표·device_id까지 포함한다. 이미지 URL은 클라이언트가
 * 현재 슬러그 경로에서 조립한다 (비밀 슬러그를 서버 응답에 싣지 않기 위함).
 */
export async function GET(req: Request) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "hidden";
  const db = getServiceClient();
  const now = Date.now();

  if (status === "reported") {
    try {
      return NextResponse.json(await reportedList(db, now), { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return new NextResponse(`DB 오류: ${(e as Error).message}`, { status: 500 });
    }
  }

  let query = db.from("drawings").select(DRAWING_COLUMNS).order("created_at", { ascending: false });
  query =
    status === "removed"
      ? query.not("removed_at", "is", null)
      : query.is("found_at", null).is("removed_at", null);

  const { data, error } = await query;
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const list = (data ?? []).map((d) => toItem(d as DrawingRow, now));
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}
