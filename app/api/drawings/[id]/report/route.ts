import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isReportReason } from "@/lib/report";

export const runtime = "nodejs";

/** 기기당 시간당 신고 수 — 목록을 훑으며 무차별 신고하는 것을 막는다 */
const REPORTS_PER_HOUR = 20;

/**
 * 그림 신고 접수.
 *
 * 미발견 그림뿐 아니라 이미 발견된 그림(히스토리에 남아 썸네일이 계속 노출됨)도 대상이다.
 * 좌표는 다루지 않으므로 숨은 그림의 위치가 새어 나갈 여지는 없다.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return new NextResponse("device id가 없습니다", { status: 400 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("잘못된 요청 본문", { status: 400 });
  }
  if (!isReportReason(body.reason)) {
    return new NextResponse("신고 사유가 올바르지 않습니다", { status: 400 });
  }

  const db = getServiceClient();

  // 레이트리밋: 최근 1시간 신고 수
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent, error: rlErr } = await db
    .from("reports")
    .select("drawing_id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("created_at", hourAgo);
  if (rlErr) return new NextResponse(`DB 오류: ${rlErr.message}`, { status: 500 });
  if ((recent ?? 0) >= REPORTS_PER_HOUR) {
    return new NextResponse("신고가 너무 많습니다. 잠시 후 다시 시도해주세요", { status: 429 });
  }

  // 이미 삭제된 그림은 신고할 것이 없다 (id를 알아도 존재 여부를 더 알려주지 않는다)
  const { data: drawing, error: selErr } = await db
    .from("drawings")
    .select("id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return new NextResponse(`DB 오류: ${selErr.message}`, { status: 500 });
  if (!drawing || drawing.removed_at) return new NextResponse("not found", { status: 404 });

  const { error: insErr } = await db
    .from("reports")
    .insert({ drawing_id: id, device_id: deviceId, reason: body.reason });
  // 23505 = unique_violation — PK(drawing_id, device_id)가 기기당 1회를 보장한다
  if (insErr?.code === "23505") {
    return new NextResponse("이미 신고한 그림입니다", { status: 409 });
  }
  if (insErr) return new NextResponse(`DB 오류: ${insErr.message}`, { status: 500 });

  return NextResponse.json({ ok: true });
}
