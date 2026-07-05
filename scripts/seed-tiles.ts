/**
 * 도안 이미지를 타일 피라미드로 잘라 data/tiles/ 에 저장한다.
 *
 *   npm run seed                  → 플레이스홀더 도안(8192×5120)을 생성해 타일링
 *   npm run seed -- path/to.png   → 실제 도안으로 타일링 (도안 교체 시 재실행하면 끝)
 *
 * 출력:
 *   data/tiles/base/{z}/{x}/{y}.webp    원본 타일 (재합성 입력, 불변)
 *   data/tiles/serve/{z}/{x}/{y}.webp   서빙 타일 (base + 합성된 그림) — 시드 직후엔 base와 동일
 *   data/tiles/meta.json                ({ width, height, tileSize, maxZoom })
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const TILE = 512;
const TILES_DIR = path.join(process.cwd(), "data", "tiles");
const BASE_DIR = path.join(TILES_DIR, "base");
const SERVE_DIR = path.join(TILES_DIR, "serve");

// ---- 플레이스홀더 도안 생성 (시드 고정 → 재실행해도 동일한 그림) ----

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function placeholderSvg(w: number, h: number): string {
  const rnd = mulberry(20260704);
  const palette = [
    "#D9825F", "#7FA76C", "#5D8AA8", "#C9A227", "#8B6FAE",
    "#C96F6F", "#5FA8A0", "#B08968", "#6B8E9E", "#A3A380",
  ];
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const parts: string[] = [];

  // 숨기기 좋은 배경 = 색·질감 밀도가 높은 배경. 도형을 촘촘히 흩뿌린다.
  const N = 1600;
  for (let i = 0; i < N; i++) {
    const x = Math.round(rnd() * w);
    const y = Math.round(rnd() * h);
    const size = 14 + rnd() * 130;
    const c = pick(palette);
    const op = (0.18 + rnd() * 0.55).toFixed(2);
    const rot = Math.round(rnd() * 360);
    const kind = Math.floor(rnd() * 6);
    if (kind === 0) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${(size / 2).toFixed(0)}" fill="${c}" opacity="${op}"/>`);
    } else if (kind === 1) {
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${(size / 2).toFixed(0)}" fill="none" stroke="${c}" stroke-width="${(2 + rnd() * 8).toFixed(1)}" opacity="${op}"/>`,
      );
    } else if (kind === 2) {
      parts.push(
        `<rect x="${x}" y="${y}" width="${size.toFixed(0)}" height="${(size * (0.4 + rnd() * 0.8)).toFixed(0)}" rx="${(size / 6).toFixed(0)}" fill="${c}" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`,
      );
    } else if (kind === 3) {
      // 잎사귀
      const s2 = size / 2;
      parts.push(
        `<path d="M ${x} ${y} q ${s2} ${-s2} ${size} 0 q ${-s2} ${s2} ${-size} 0 z" fill="${c}" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`,
      );
    } else if (kind === 4) {
      // 별
      const s = size / 2;
      const pts: string[] = [];
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 === 0 ? s : s * 0.45;
        const a = (Math.PI / 5) * k - Math.PI / 2;
        pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
      }
      parts.push(`<polygon points="${pts.join(" ")}" fill="${c}" opacity="${op}"/>`);
    } else {
      // 구불선
      const len = size * 2.2;
      parts.push(
        `<path d="M ${x} ${y} q ${len / 4} ${-size / 2} ${len / 2} 0 t ${len / 2} 0" fill="none" stroke="${c}" stroke-width="${(2 + rnd() * 6).toFixed(1)}" stroke-linecap="round" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="g1" cx="20%" cy="25%" r="70%">
      <stop offset="0%" stop-color="#F3E7C9"/><stop offset="100%" stop-color="#EFEAD8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="80%" cy="70%" r="70%">
      <stop offset="0%" stop-color="#DCE7DA"/><stop offset="100%" stop-color="#EFEAD8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#EFEAD8"/>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <rect width="100%" height="100%" fill="url(#g2)"/>
  ${parts.join("\n  ")}
</svg>`;
}

// ---- 타일링 ----

async function main() {
  const srcPath = process.argv[2];
  let source: Buffer;

  if (srcPath) {
    source = await fs.readFile(srcPath);
    console.log(`도안: ${srcPath}`);
  } else {
    const W = 8192;
    const H = 5120;
    console.log(`도안 미지정 → 플레이스홀더 생성 (${W}×${H})`);
    source = await sharp(Buffer.from(placeholderSvg(W, H)), { limitInputPixels: false })
      .png()
      .toBuffer();
  }

  const img = sharp(source, { limitInputPixels: false });
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("이미지 크기를 읽을 수 없습니다");

  const maxZoom = Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / TILE)));
  console.log(`크기 ${width}×${height}, 타일 ${TILE}px, maxZoom ${maxZoom}`);

  await fs.rm(TILES_DIR, { recursive: true, force: true });

  let total = 0;
  for (let z = maxZoom; z >= 0; z--) {
    const scale = 2 ** (z - maxZoom);
    const lw = Math.max(1, Math.round(width * scale));
    const lh = Math.max(1, Math.round(height * scale));
    const level = await sharp(source, { limitInputPixels: false })
      .resize(lw, lh)
      .png()
      .toBuffer();

    const tilesX = Math.ceil(lw / TILE);
    const tilesY = Math.ceil(lh / TILE);
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const left = tx * TILE;
        const top = ty * TILE;
        const webp = await sharp(level)
          .extract({ left, top, width: Math.min(TILE, lw - left), height: Math.min(TILE, lh - top) })
          .webp({ quality: 82 })
          .toBuffer();
        // 원본과 서빙본에 동일하게 기록 (아직 숨은 그림 없음)
        for (const root of [BASE_DIR, SERVE_DIR]) {
          const dir = path.join(root, String(z), String(tx));
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(path.join(dir, `${ty}.webp`), webp);
        }
        total++;
      }
    }
    console.log(`  z=${z}: ${tilesX}×${tilesY} = ${tilesX * tilesY}타일`);
  }

  await fs.writeFile(
    path.join(TILES_DIR, "meta.json"),
    JSON.stringify({ width, height, tileSize: TILE, maxZoom }, null, 2),
  );
  console.log(`완료: 총 ${total}타일 (base+serve) → ${TILES_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
