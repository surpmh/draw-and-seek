import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { readTilesetMeta } from "@/lib/canvas-meta";
import { recompositeTiles, tilesForBbox } from "@/lib/composite";
import { loadDrawingRects, type DrawingRow } from "@/lib/drawings-store";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** 대상 그림 영역의 타일을 현재 미발견 그림 기준으로 재합성하고 버전을 올린다 */
async function recompositeAndBump(
  db: ReturnType<typeof getServiceClient>,
  bbox: { x: number; y: number; w: number; h: number },
): Promise<number | NextResponse> {
  const meta = await readTilesetMeta();
  const { data: unfoundRows, error } = await db
    .from("drawings")
    .select("id, x, y, w, h, image_path")
    .is("found_at", null);
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });
  const unfound = await loadDrawingRects((unfoundRows ?? []) as DrawingRow[]);
  await recompositeTiles(tilesForBbox(bbox, meta), unfound, meta);

  const { data: ver, error: verErr } = await db.rpc("bump_canvas_version");
  if (verErr) return new NextResponse(`DB 오류: ${verErr.message}`, { status: 500 });
  return Number(ver);
}

/**
 * 관리자 전용: 그림 삭제(제재) — 복구 가능한 소프트 삭제.
 * removed_at을 기록하고, 미발견 그림이었다면 found_at도 같은 값으로 채워
 * 캔버스·목록의 기존 필터(found_at is null)에서 즉시 빠지게 한다.
 * DB 행과 PNG 파일은 그대로 보존 → 실수여도 복구(POST)로 되돌릴 수 있다.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  const db = getServiceClient();
  const { data: row, error: selErr } = await db
    .from("drawings")
    .select("id, x, y, w, h, found_at, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return new NextResponse(`DB 오류: ${selErr.message}`, { status: 500 });
  if (!row) return new NextResponse("그림을 찾을 수 없습니다", { status: 404 });
  if (row.removed_at) return new NextResponse("이미 삭제된 그림입니다", { status: 409 });

  const wasVisible = !row.found_at;
  const ts = new Date().toISOString();
  const { error: updErr } = await db
    .from("drawings")
    // found_at === removed_at 이면 "삭제 때문에 캔버스에서 내려온 것" — 복구 시 이 동등성으로 원상태 판별
    .update({ removed_at: ts, found_at: row.found_at ?? ts })
    .eq("id", id);
  if (updErr) return new NextResponse(`DB 오류: ${updErr.message}`, { status: 500 });

  // 캔버스에 노출 중이던 그림이면 해당 영역 타일에서 지우고 버전 갱신
  let version: number | null = null;
  if (wasVisible) {
    const result = await recompositeAndBump(db, row);
    if (result instanceof NextResponse) return result;
    version = result;
  }
  return NextResponse.json({ ok: true, version });
}

/**
 * 관리자 전용: 삭제(제재) 복구.
 * 삭제 당시 캔버스에 있던 그림(found_at === removed_at)이면 다시 노출시킨다.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  const db = getServiceClient();
  const { data: row, error: selErr } = await db
    .from("drawings")
    .select("id, x, y, w, h, found_at, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return new NextResponse(`DB 오류: ${selErr.message}`, { status: 500 });
  if (!row) return new NextResponse("그림을 찾을 수 없습니다", { status: 404 });
  if (!row.removed_at) return new NextResponse("삭제된 그림이 아닙니다", { status: 409 });

  const wasVisible = row.found_at === row.removed_at;
  const { error: updErr } = await db
    .from("drawings")
    .update({ removed_at: null, found_at: wasVisible ? null : row.found_at })
    .eq("id", id);
  if (updErr) return new NextResponse(`DB 오류: ${updErr.message}`, { status: 500 });

  // 다시 캔버스에 노출되는 경우 타일에 그려 넣고 버전 갱신
  let version: number | null = null;
  if (wasVisible) {
    const result = await recompositeAndBump(db, row);
    if (result instanceof NextResponse) return result;
    version = result;
  }
  return NextResponse.json({ ok: true, version });
}
