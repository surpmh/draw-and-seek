/**
 * Supabase 연결 + 스키마 검증, 그리고 canvas 단일 행을 시드한다.
 *   npm run check-db
 *
 * 마이그레이션(supabase/migrations/)이 적용된 상태여야 한다.
 * 로컬은 `npm run db:reset`, 운영은 SQL Editor에 붙여넣어 실행.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

// Next.js와 동일하게 .env.local 우선 로드
// 기본은 로컬 개발 DB(.env.local). 프로덕션을 건드리려면 반드시 명시해야 한다:
//   ENV_FILE=.env.prod.local npm run <script>
config({ path: process.env.ENV_FILE ?? ".env.local" });

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("REPLACE_ME") || key.includes("REPLACE_ME")) {
    console.error("✗ .env.local의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 실제 값으로 채워주세요");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1) 테이블 존재 확인
  for (const t of ["canvas", "drawings", "find_attempts"]) {
    const { error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`✗ 테이블 '${t}' 접근 실패: ${error.message}`);
      console.error("  → 마이그레이션이 적용됐는지 확인하세요 (로컬: npm run db:reset / 운영: SQL Editor)");
      process.exit(1);
    }
    console.log(`✓ 테이블 '${t}' 확인`);
  }

  // 2) 타일셋 meta에서 캔버스 크기를 읽어 canvas 행 시드 (없을 때만)
  const metaRaw = await fs.readFile(path.join(process.cwd(), "data", "tiles", "meta.json"), "utf8");
  const meta = JSON.parse(metaRaw) as { width: number; height: number };
  const { data: existing } = await db.from("canvas").select("id, version").eq("id", 1).maybeSingle();
  if (!existing) {
    const { error } = await db.from("canvas").insert({ id: 1, width: meta.width, height: meta.height });
    if (error) {
      console.error(`✗ canvas 행 시드 실패: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ canvas 행 생성 (${meta.width}×${meta.height}, version 1)`);
  } else {
    console.log(`✓ canvas 행 이미 존재 (version ${existing.version})`);
  }

  // 3) bump 함수 확인
  const { data: v, error: bumpErr } = await db.rpc("bump_canvas_version");
  if (bumpErr) {
    console.error(`✗ bump_canvas_version() 호출 실패: ${bumpErr.message}`);
    process.exit(1);
  }
  console.log(`✓ bump_canvas_version() 동작 확인 → version 이제 ${v}`);

  console.log("\n모든 검증 통과 ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
