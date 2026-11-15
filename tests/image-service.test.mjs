import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import sharp from "sharp";
import { createImageHandler } from "../supabase/functions/image-service/handler.ts";
import { compositeTile, initializeImageEngine, inspectPng, prepareDrawing } from "../supabase/functions/image-service/engine.ts";

const require = createRequire(import.meta.url);
const id = "00000000-0000-4000-8000-000000000001";
const secret = "local-test-key";
before(async () => initializeImageEngine(readFileSync(require.resolve("@imagemagick/magick-wasm/magick.wasm"))));

function storageFixture() {
  const files = new Map();
  const handler = createImageHandler({
    async download(key) { return files.get(key) ?? null; },
    async upload(key, bytes) { files.set(key, bytes); },
  }, secret);
  return {
    files,
    handler,
    post(operation, body, headers = {}) {
      return handler(new Request(`https://example.test/image-service/${operation}`, {
        method: "POST", body,
        headers: { authorization: `Bearer ${secret}`, ...headers },
      }));
    },
  };
}

async function png(width = 128, height = width, background = { r: 255, g: 0, b: 0, alpha: 1 }) {
  return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
}

test("image operations reject anonymous and incorrect credentials before processing", async () => {
  const { handler, files } = storageFixture();
  for (const authorization of ["", "Bearer wrong", "Bearer local-test-keY"]) {
    const response = await handler(new Request("https://example.test/save", {
      method: "POST", headers: { authorization }, body: "invalid png",
    }));
    assert.equal(response.status, 401);
  }
  assert.equal(files.size, 0);
});

test("saving trims transparent margins and generates small private derivatives", async () => {
  const source = await sharp({ create: { width: 900, height: 900, channels: 4, background: "transparent" } })
    .composite([{ input: await png(300, 150), left: 100, top: 200 }]).png().toBuffer();
  const fixture = storageFixture();
  const response = await fixture.post("save", source, { "x-drawing-id": id });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { imagePath: `${id}.png` });
  const original = await sharp(fixture.files.get(`drawings/${id}.png`)).metadata();
  const thumb = await sharp(fixture.files.get(`thumbnails/${id}.webp`)).metadata();
  const composite = await sharp(fixture.files.get(`composites/${id}.png`)).metadata();
  assert.deepEqual([original.width, original.height], [300, 150]);
  assert.deepEqual([thumb.width, thumb.height, thumb.format], [96, 48, "webp"]);
  assert.deepEqual([composite.width, composite.height], [128, 64]);
});

test("blank, oversized, and invalid images cannot be stored", async () => {
  const fixture = storageFixture();
  const blank = await png(128, 128, { r: 0, g: 0, b: 0, alpha: 0 });
  assert.equal(inspectPng(blank), null);
  assert.equal((await fixture.post("save", blank, { "x-drawing-id": id })).status, 400);
  assert.equal((await fixture.post("inspect", await png(2049, 1))).status, 400);
  assert.equal((await fixture.post("save", await png(), { "x-drawing-id": "../private" })).status, 400);
  assert.equal(fixture.files.size, 0);
});

test("legacy thumbnails are generated once into the same private bucket", async () => {
  const fixture = storageFixture();
  fixture.files.set(`drawings/${id}.png`, await png(128, 64));
  const response = await fixture.post("thumbnail", JSON.stringify({ imagePath: `${id}.png` }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.ok(fixture.files.has(`thumbnails/${id}.webp`));
  assert.equal((await fixture.post("thumbnail", JSON.stringify({ imagePath: "../secret.png" }))).status, 400);
});

async function pixel(image, x, y) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  return [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
}

test("a drawing crossing a tile boundary appears in both tiles and disappears when found", async () => {
  const fixture = storageFixture();
  const white = await sharp(await png(512, 512, { r: 255, g: 255, b: 255, alpha: 1 })).webp().toBuffer();
  fixture.files.set("tiles/base/0/0/0.webp", white);
  fixture.files.set("tiles/base/0/1/0.webp", white);
  fixture.files.set(`drawings/${id}.png`, await png());
  const drawing = { id, image_path: `${id}.png`, x: 500, y: 200, w: 32, h: 32 };
  const payload = { meta: { width: 1024, height: 512, maxZoom: 0 }, drawings: [drawing] };
  for (const tx of [0, 1]) {
    const response = await fixture.post("tile", JSON.stringify({ ...payload, tile: { z: 0, tx, ty: 0 } }));
    assert.equal(response.status, 200);
    const [r, g, b] = await pixel(fixture.files.get(`tiles/serve/0/${tx}/0.webp`), tx === 0 ? 505 : 5, 210);
    assert.ok(r > 240 && g < 20 && b < 20, `expected red on tile ${tx}, received ${r},${g},${b}`);
  }
  // Existing drawings also get the small composite derivative on first use.
  assert.ok(fixture.files.has(`composites/${id}.png`));
  await fixture.post("tile", JSON.stringify({ ...payload, drawings: [], tile: { z: 0, tx: 0, ty: 0 } }));
  assert.ok((await pixel(fixture.files.get("tiles/serve/0/0/0.webp"), 505, 210)).every((value) => value > 245));
});

test("tile processing handles many overlapping small images with bounded output", async (t) => {
  const base = await sharp(await png(512, 512)).webp().toBuffer();
  const drawing = prepareDrawing(await png()).composite;
  const overlays = Array.from({ length: 100 }, (_, n) => ({
    id, image_path: `${id}.png`, x: n * 3, y: n * 3, w: 128, h: 128, bytes: drawing,
  }));
  const started = process.cpuUsage();
  const output = compositeTile(base, overlays, { tile: { z: 0, tx: 0, ty: 0 }, meta: { width: 512, height: 512, maxZoom: 0 }, drawings: [] });
  const elapsed = process.cpuUsage(started);
  t.diagnostic(`Local WASM tile CPU: ${Math.round((elapsed.user + elapsed.system) / 1000)}ms (100 overlays; hosted limits require deployment validation)`);
  const metadata = await sharp(output).metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.format], [512, 512, "webp"]);
});
