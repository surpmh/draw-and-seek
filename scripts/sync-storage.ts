/**
 * 로컬 data/ 를 Supabase Storage(canvas 버킷)로 업로드한다.
 *   npm run sync-storage
 *
 * - 버킷이 없으면 비공개로 생성
 * - data/tiles/** → tiles/** (meta.json, base/, serve/)
 * - data/drawings/*.png → drawings/*.png
 *
 * 시드 절차: npm run seed -- artwork.png (로컬 타일 생성) → npm run sync-storage
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

// 기본은 로컬 개발 DB(.env.local). 프로덕션을 건드리려면 반드시 명시해야 한다:
//   ENV_FILE=.env.prod.local npm run <script>
config({ path: process.env.ENV_FILE ?? ".env.local" });

const BUCKET = "canvas";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const contentType = (p: string) =>
  p.endsWith(".webp") ? "image/webp" : p.endsWith(".png") ? "image/png" : "application/json";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✗ .env.local의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 버킷 확인/생성 (비공개 — 서빙은 API 라우트가 담당)
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false });
    if (error) {
      console.error(`✗ 버킷 생성 실패: ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ 버킷 '${BUCKET}' 생성`);
  } else {
    console.log(`✓ 버킷 '${BUCKET}' 확인`);
  }

  // (로컬 디렉터리, Storage 접두사) 쌍
  const targets: [string, string][] = [
    [path.join(process.cwd(), "data", "tiles"), "tiles"],
    [path.join(process.cwd(), "data", "drawings"), "drawings"],
  ];

  let ok = 0;
  let failed = 0;
  for (const [dir, prefix] of targets) {
    let files: string[] = [];
    try {
      for await (const f of walk(dir)) files.push(f);
    } catch {
      console.log(`- ${dir} 없음 — 건너뜀`);
      continue;
    }
    // 동시 업로드 8개씩
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(
        files.slice(i, i + 8).map(async (f) => {
          const rel = path.relative(dir, f).split(path.sep).join("/");
          const storageKey = `${prefix}/${rel}`;
          const buf = await fs.readFile(f);
          const { error } = await db.storage
            .from(BUCKET)
            .upload(storageKey, buf, { contentType: contentType(f), upsert: true });
          if (error) {
            failed++;
            console.error(`✗ ${storageKey}: ${error.message}`);
          } else {
            ok++;
          }
        }),
      );
      process.stdout.write(`\r업로드 ${Math.min(i + 8, files.length)}/${files.length} (${prefix})   `);
    }
    console.log();
  }

  console.log(`\n완료: ${ok}개 업로드${failed ? `, ${failed}개 실패` : ""} ✅`);
  if (failed) process.exit(1);
}

main();
