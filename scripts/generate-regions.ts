/**
 * Pollinations API(flux)로 도안 구역 이미지들을 격자로 생성한다.
 *
 *   npm run gen-regions                          → 기본 11×7 격자
 *   GRID_COLS=2 GRID_ROWS=2 npm run gen-regions  → 시험용 소격자
 *
 * - 결과: data/regions/r{row}c{col2자리}.jpg
 * - 이미 존재하는 파일은 건너뛰므로 중단돼도 재실행하면 이어서 생성 (resume)
 * - 인접 셀이 같은 테마 존을 공유하도록 3×3 블록 단위로 테마 배정
 *
 * 이후:
 *   npm run stitch -- --cols 11 --trim 0.04 --out data/stitched.png $(ls data/regions/*.jpg | sort)
 *   npm run seed -- data/stitched.png
 */
import { config } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local" });

const KEY = process.env.POLLINATIONS_API_KEY;
const OUT_DIR = path.join(process.cwd(), "data", "regions");

const COLS = Number(process.env.GRID_COLS || 11);
const ROWS = Number(process.env.GRID_ROWS || 7);
const CELL = 1024; // 요청 크기 (무료 티어는 768로 응답될 수 있음 — 스티칭이 알아서 맞춤)
const DELAY_MS = 4000; // 레이트리밋 배려

// full-bleed 강조: 테두리/프레임이 생기면 이어붙일 때 이음새가 됨
const STYLE =
  "Children's hidden-object puzzle book illustration, one seamless section of a giant zoo and amusement park map, " +
  "top-down slightly angled view, thick clean dark outlines, vibrant flat colors, " +
  "extremely dense and busy composition filled with dozens of tiny cartoon people and animals doing funny activities, " +
  "trees bushes benches balloons food stalls scattered everywhere covering the entire canvas, " +
  "full-bleed edge-to-edge illustration, the scenery continues past every edge, " +
  "absolutely no border, no frame, no white margin, no rounded corners, " +
  "consistent character scale, no text, no watermark";

// 테마 존 — 3×3 셀 블록이 같은 테마를 공유해 공간적으로 뭉치게 함
const THEMES = [
  "grand park entrance plaza with ornate gates, ticket booths, balloon vendors, fountains, arriving families",
  "giant ferris wheel and rainbow roller coaster area with carousels and long queues",
  "savanna safari zone with elephants giraffes lions zebras behind wooden fences and safari trucks",
  "arctic penguin pools and aquarium domes with seals dolphins and ice cream stands",
  "dense jungle trek zone with monkeys parrots rope bridges and explorer kids",
  "big central lake with paddle boats ducks fishing spots and picnic families",
  "food court area with colorful snack stalls, cotton candy, popcorn carts, picnic tables",
  "playground zone with slides swings sandboxes and running children",
  "flower garden maze with topiary animals, butterflies, gardeners at work",
  "petting zoo corner with rabbits goats ponies and feeding stations",
  "circus tent area with jugglers clowns acrobats and audience benches",
  "dinosaur themed mini-land with dino statues, fossil dig pit, excited kids",
];

const zoneOf = (row: number, col: number) => {
  const zoneCol = Math.floor(col / 3);
  const zoneRow = Math.floor(row / 3);
  const zonesPerRow = Math.ceil(COLS / 3);
  return THEMES[(zoneRow * zonesPerRow + zoneCol) % THEMES.length];
};

async function generate(prompt: string, seed: number): Promise<Buffer> {
  const url =
    "https://image.pollinations.ai/prompt/" +
    encodeURIComponent(prompt) +
    `?width=${CELL}&height=${CELL}&model=flux&nologo=true&seed=${seed}&token=${KEY}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10_000) return buf; // 비정상적으로 작은 응답 방어
      }
      console.warn(`    시도 ${attempt}: HTTP ${res.status} — 대기 후 재시도`);
    } catch (e) {
      console.warn(`    시도 ${attempt}: ${(e as Error).message} — 대기 후 재시도`);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  throw new Error("생성 실패 (4회 시도)");
}

async function main() {
  if (!KEY || KEY.includes("REPLACE")) {
    console.error("POLLINATIONS_API_KEY가 .env.local에 없습니다");
    process.exit(5);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });

  const total = COLS * ROWS;
  let done = 0;
  let skipped = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const name = `r${row}c${String(col).padStart(2, "0")}`;
      const file = path.join(OUT_DIR, `${name}.jpg`);
      done++;
      try {
        await fs.access(file);
        skipped++;
        continue; // resume: 이미 있으면 건너뜀
      } catch {}

      const theme = zoneOf(row, col);
      const prompt = `${STYLE}. This section shows: ${theme}, section variant ${((row * COLS + col) % 9) + 1}`;
      const seed = 1000 + row * 100 + col;
      console.log(`[${done}/${total}] ${name} — ${theme.slice(0, 44)}...`);
      const buf = await generate(prompt, seed);
      await fs.writeFile(file, buf);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  console.log(`\n완료: ${total - skipped}장 생성, ${skipped}장 기존 재사용 → ${OUT_DIR}`);
  console.log(`스티칭: npm run stitch -- --cols ${COLS} --trim 0.04 --out data/stitched.png $(ls data/regions/*.jpg | sort)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
