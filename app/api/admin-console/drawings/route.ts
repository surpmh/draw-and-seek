import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * 관리자 전용 그림 목록.
 *   ?status=hidden  (기본) — 캔버스에 숨어있는 미발견 그림
 *   ?status=removed        — 관리자가 삭제(제재)한 그림 (복구 대상)
 * 공개 API와 달리 좌표·device_id까지 포함한다. 이미지 URL은 클라이언트가
 * 현재 슬러그 경로에서 조립한다 (비밀 슬러그를 서버 응답에 싣지 않기 위함).
 */
export async function GET(req: Request) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "hidden";
  const db = getServiceClient();

  let query = db
    .from("drawings")
    .select("id, nickname, device_id, created_at, removed_at, x, y, w, h")
    .order("created_at", { ascending: false });
  query =
    status === "removed"
      ? query.not("removed_at", "is", null)
      : query.is("found_at", null).is("removed_at", null);

  const { data, error } = await query;
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const now = Date.now();
  const list = (data ?? []).map((d) => ({
    id: d.id,
    nickname: d.nickname,
    deviceId: d.device_id,
    hiddenAt: d.created_at,
    hiddenMs: now - new Date(d.created_at).getTime(),
    removedAt: d.removed_at as string | null,
    x: d.x,
    y: d.y,
    w: d.w,
    h: d.h,
  }));
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}
