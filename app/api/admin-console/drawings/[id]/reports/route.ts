import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * 관리자 전용: 신고 반려 — "확인했고 문제없음".
 *
 * 신고 행은 지우지 않고 dismissed_at만 채운다. 행을 지우면 같은 기기가 다시 신고해
 * 목록을 되살릴 수 있는데, 남겨 두면 PK(drawing_id, device_id)가 그걸 막아 준다.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  const { error } = await getServiceClient()
    .from("reports")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("drawing_id", id)
    .is("dismissed_at", null);
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  return NextResponse.json({ ok: true });
}
