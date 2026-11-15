const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const sharp = require("sharp");

// Execute the real route with isolated DB/storage mocks; never upload test images.
function loadTs(relativePath, mocks = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    Buffer,
    console,
  }, { filename });
  return module.exports;
}

function createUpload() {
  const saved = [];
  const inserted = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    async gte() { return { count: 0, error: null }; },
    async insert(row) { inserted.push(row); return { error: null }; },
  };
  const { POST } = loadTs("app/api/drawings/route.ts", {
    "next/server": { NextResponse: require("next/server").NextResponse, after() {} },
    "@/lib/placement": loadTs("lib/placement.ts"),
    "@/lib/ink-metrics": loadTs("lib/ink-metrics.ts", { "./placement": loadTs("lib/placement.ts") }),
    "@/lib/supabase": { getServiceClient: () => ({ from: () => query }) },
    "@/lib/canvas-meta": { readTilesetMeta: async () => ({ width: 4096, height: 4096 }) },
    "@/lib/composite": {},
    "@/lib/drawings-store": {
      async saveDrawingPng(id, png) { saved.push(png); return `drawings/${id}.png`; },
    },
  });
  return {
    saved,
    inserted,
    async post(png, side = 128) {
      return POST(new Request("http://localhost/api/drawings", {
        method: "POST",
        headers: { "x-device-id": "00000000-0000-4000-8000-000000000000" },
        body: JSON.stringify({
          nickname: "regression",
          imageDataUrl: `data:image/png;base64,${png.toString("base64")}`,
          x: 100, y: 100, w: side, h: side,
        }),
      }));
    },
  };
}

async function svgPng(size, content) {
  return sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${content}</svg>`,
  )).png().toBuffer();
}

for (const brush of [5, 6, 12]) {
  test(`rejects three separated dots drawn with a ${brush}px pen`, async () => {
    const png = await svgPng(186, [20, 93, 166].map((x) =>
      `<circle cx="${x}" cy="93" r="${brush / 2}" fill="#1b1e23"/>`,
    ).join(""));
    const upload = createUpload();
    const response = await upload.post(png);
    assert.equal(response.status, 400);
    assert.match(await response.text(), /그림이 너무 희미해요/);
    assert.equal(upload.saved.length, 0);
    assert.equal(upload.inserted.length, 0);
  });
}

for (const [pixels, status] of [[511, 400], [512, 200]]) {
  test(`${pixels} colored pixels ${status === 200 ? "meet" : "fall below"} the minimum`, async () => {
    const rgba = Buffer.alloc(128 * 128 * 4);
    // Both fixtures span 64×24px. Only the colored area differs by one pixel.
    let painted = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 64; x++) {
      if (x === 0 || x === 63 || y === 0 || y === 23) {
        rgba[(y * 128 + x) * 4 + 3] = 255;
        painted++;
      }
    }
    for (let y = 1; y < 23 && painted < pixels; y++) for (let x = 1; x < 63 && painted < pixels; x++) {
      rgba[(y * 128 + x) * 4 + 3] = 255;
      painted++;
    }
    const png = await sharp(rgba, { raw: { width: 128, height: 128, channels: 4 } }).png().toBuffer();
    const upload = createUpload();
    assert.equal((await upload.post(png)).status, status);
    assert.equal(upload.saved.length, status === 200 ? 1 : 0);
    assert.equal(upload.inserted.length, status === 200 ? 1 : 0);
  });
}

test("accepts an unfilled drawing with ordinary thin lines", async () => {
  const png = await svgPng(128, '<path d="M24 96 L64 24 L104 96 Z" fill="none" stroke="#1b1e23" stroke-width="3"/>');
  assert.equal((await createUpload().post(png)).status, 200);
});

for (const [name, line] of [
  ["horizontal", "M16 64 L112 64"],
  ["vertical", "M64 16 L64 112"],
  ["diagonal", "M24 24 L104 104"],
  ["slanted", "M16 40 L112 88"],
]) {
  test(`rejects a ${name} straight line even when its ink exceeds 512px²`, async () => {
    const png = await svgPng(128, `<path d="${line}" stroke="black" stroke-width="8" stroke-linecap="round"/>`);
    const upload = createUpload();
    const response = await upload.post(png);
    assert.equal(response.status, 400);
    assert.match(await response.text(), /폭이 너무 좁아요/);
    assert.equal(upload.saved.length, 0);
    assert.equal(upload.inserted.length, 0);
  });
}

for (const resolution of [1, 2, 3]) {
  test(`measures ink in world pixels at ${resolution}x source resolution`, async () => {
    for (const [stroke, status] of [[3, 400], [4, 200]]) {
      const png = await svgPng(128 * resolution,
        `<g transform="scale(${resolution})"><rect x="${stroke / 2}" y="${stroke / 2}" width="${64 - stroke}" height="${24 - stroke}" fill="none" stroke="black" stroke-width="${stroke}"/></g>`,
      );
      assert.equal((await createUpload().post(png)).status, status);
    }
  });
}

for (const [width, status] of [[23, 400], [24, 200]]) {
  test(`a filled shape ${width}px wide ${status === 200 ? "meets" : "falls below"} the width minimum`, async () => {
    const png = await svgPng(128, `<rect x="0" y="0" width="64" height="${width}" fill="black"/>`);
    assert.equal((await createUpload().post(png)).status, status);
  });
}

test("rejects a narrow line with a grayscale alpha channel", async () => {
  const png = await sharp(await svgPng(128, '<rect x="0" y="0" width="64" height="12" fill="black"/>'))
    .greyscale().png({ colourType: 4 }).toBuffer();
  assert.equal((await createUpload().post(png)).status, 400);
});
