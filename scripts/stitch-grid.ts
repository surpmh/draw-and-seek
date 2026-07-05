/**
 * 구역 이미지들을 격자로 이어붙여 초대형 도안을 만든다.
 *
 *   npm run stitch -- --cols 2 --out data/stitched.png a1.png a2.png b1.png b2.png
 *
 * - 이미지 순서: 왼쪽→오른쪽, 위→아래 (행 우선)
 * - 셀 크기가 서로 달라도 됨: 가장 작은 셀 크기에 맞춰 cover-크롭해 정렬
 * - 결과물은 그대로 `npm run seed -- <out>` 에 넣으면 됨
 */
import sharp from "sharp";
import path from "node:path";

interface Args {
  cols: number;
  out: string;
  files: string[];
  /** 각 셀 가장자리를 잘라내는 비율 (0~0.2) — AI 생성물의 테두리/프레임 제거용 */
  trim: number;
}

function parseArgs(argv: string[]): Args {
  let cols = 0;
  let out = "";
  let trim = 0;
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cols") cols = Number(argv[++i]);
    else if (argv[i] === "--out") out = argv[++i];
    else if (argv[i] === "--trim") trim = Math.min(0.2, Math.max(0, Number(argv[++i])));
    else files.push(argv[i]);
  }
  if (!cols || !out || files.length === 0) {
    console.error("사용법: npm run stitch -- --cols N --out 결과.png 이미지1 이미지2 ...");
    process.exit(4);
  }
  if (files.length % cols !== 0) {
    console.error(`이미지 수(${files.length})가 열 수(${cols})로 나누어떨어지지 않습니다`);
    process.exit(4);
  }
  return { cols, out, files, trim };
}

async function main() {
  const { cols, out, files, trim } = parseArgs(process.argv.slice(2));
  const rows = files.length / cols;

  // 모든 셀의 최소 크기 파악 (서로 다르면 cover-크롭으로 통일)
  const metas = await Promise.all(
    files.map((f) => sharp(f, { limitInputPixels: false }).metadata()),
  );
  const cellW = Math.min(...metas.map((m) => m.width!));
  const cellH = Math.min(...metas.map((m) => m.height!));
  const totalW = cellW * cols;
  const totalH = cellH * rows;
  console.log(`격자 ${cols}×${rows}, 셀 ${cellW}×${cellH} → 전체 ${totalW}×${totalH}`);

  const overlays: sharp.OverlayOptions[] = [];
  for (let i = 0; i < files.length; i++) {
    let cell = sharp(files[i], { limitInputPixels: false });
    if (trim > 0) {
      const m = metas[i];
      const dx = Math.round(m.width! * trim);
      const dy = Math.round(m.height! * trim);
      cell = cell.extract({ left: dx, top: dy, width: m.width! - dx * 2, height: m.height! - dy * 2 });
    }
    const buf = await cell
      .resize(cellW, cellH, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    overlays.push({
      input: buf,
      left: (i % cols) * cellW,
      top: Math.floor(i / cols) * cellH,
    });
    console.log(`  [${i + 1}/${files.length}] ${path.basename(files[i])}`);
  }

  await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: "#ffffff" },
    limitInputPixels: false,
  })
    .composite(overlays)
    .png()
    .toFile(out);
  console.log(`완료: ${out} (${totalW}×${totalH})`);
  console.log(`적용: npm run seed -- ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
