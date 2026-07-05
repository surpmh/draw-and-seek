import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { readTilesetMeta } from "@/lib/canvas-meta";
import { recompositeTiles, tilesForBbox } from "@/lib/composite";
import { loadDrawingRects, type DrawingRow } from "@/lib/drawings-store";

export const runtime = "nodejs";

/** 클릭 허용 오차 (월드 px) — 손가락/저배율 배려 */
const TOLERANCE = 12;
const FINDS_PER_MINUTE = 30;

export async function POST(req: Request) {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return new NextResponse("device id가 없습니다", { status: 400 });
  }

  let body: { x?: number; y?: number };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("잘못된 요청 본문", { status: 400 });
  }
  const { x, y } = body;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return new NextResponse("좌표가 올바르지 않습니다", { status: 400 });
  }

  const db = getServiceClient();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // 레이트리밋: 분당 판정 요청 수 (무차별 클릭 스캔 방지)
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await db
    .from("find_attempts")
    .select("device_id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("attempted_at", minuteAgo);
  if ((recent ?? 0) >= FINDS_PER_MINUTE) {
    return new NextResponse("잠시 천천히! 클릭이 너무 빨라요", { status: 429 });
  }
  await db.from("find_attempts").insert({ device_id: deviceId, ip });

  // bbox(+오차) 후보 조회 — 서버에서만 좌표를 다룬다
  const { data: rows, error } = await db
    .from("drawings")
    .select("id, nickname, created_at, x, y, w, h, image_path")
    .is("found_at", null)
    .lte("x", (x as number) + TOLERANCE)
    .lte("y", (y as number) + TOLERANCE);
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const candidates = (rows ?? []).filter(
    (d) => (x as number) <= d.x + d.w + TOLERANCE && (y as number) <= d.y + d.h + TOLERANCE,
  );

  // 판정 = 잉크에 딱 맞춘(trim된) bbox + TOLERANCE.
  // 속 빈 도형·열린 선("−") 등 어떤 형태든 그림 영역 클릭이면 명중 —
  // 그림 바깥 투명 배경은 bbox 밖이므로 여전히 미스. (candidates가 이미 그 조건)
  const hit = candidates[0] ?? null;

  if (!hit) return NextResponse.json({ found: false });

  // 소프트 델리트 — 동시 클릭 경합은 found_at IS NULL 조건으로 한 명만 승리
  const { data: updated, error: updErr } = await db
    .from("drawings")
    .update({ found_at: new Date().toISOString() })
    .eq("id", hit.id)
    .is("found_at", null)
    .select("id");
  if (updErr) return new NextResponse(`DB 오류: ${updErr.message}`, { status: 500 });
  if (!updated?.length) return NextResponse.json({ found: false }); // 다른 사람이 먼저 찾음

  // 발견된 그림을 제외하고 영향 타일 재합성
  const meta = await readTilesetMeta();
  const { data: unfoundRows } = await db
    .from("drawings")
    .select("id, x, y, w, h, image_path")
    .is("found_at", null);
  const unfound = await loadDrawingRects((unfoundRows ?? []) as DrawingRow[]);
  await recompositeTiles(tilesForBbox(hit, meta), unfound, meta);

  const { data: version } = await db.rpc("bump_canvas_version");

  const hiddenMs = Date.now() - new Date(hit.created_at).getTime();
  return NextResponse.json({
    found: true,
    nickname: hit.nickname,
    hiddenMs,
    version: Number(version),
  });
}
