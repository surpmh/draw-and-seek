const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function createRoute(cachedResponse) {
  const keys = [];
  const writes = [];
  const after = [];
  let downloads = 0;
  const cache = {
    async match(key) {
      // Workers rejects the Request object supplied by the Next.js adapter.
      if (typeof key !== "string") throw new TypeError("Invalid URL: [object Request]");
      keys.push(key);
      return cachedResponse;
    },
    async put(key, response) {
      assert.equal(typeof key, "string");
      writes.push({ key, bytes: Buffer.from(await response.arrayBuffer()) });
    },
  };
  const filename = path.join(__dirname, "../app/api/tiles/[z]/[x]/[y]/route.ts");
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const mocks = {
    "next/server": { NextResponse: require("next/server").NextResponse, after: (fn) => after.push(fn) },
    "@/lib/canvas-meta": { readTilesetMeta: async () => ({ width: 4096, height: 2305, maxZoom: 3 }) },
    "@/lib/storage": { storageDownloadFresh: async () => { downloads++; return Buffer.from("fresh tile"); } },
  };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, require: (name) => mocks[name], Uint8Array,
    caches: { open: async (name) => { assert.equal(name, "drawandseek-tiles"); return cache; } },
  }, { filename });
  return { GET: module.exports.GET, keys, writes, after, downloads: () => downloads };
}

const params = { params: Promise.resolve({ z: "0", x: "0", y: "0" }) };

test("tile cache miss uses the full versioned URL and caches the response after sending it", async () => {
  const route = createRoute();
  const url = "https://drawandseek.test/api/tiles/0/0/0?v=229";
  const response = await route.GET(new Request(url), params);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "fresh tile");
  assert.match(response.headers.get("cache-control"), /immutable/);
  assert.deepEqual(route.keys, [url]);
  assert.equal(route.downloads(), 1);
  assert.equal(route.writes.length, 0);
  await route.after[0]();
  assert.equal(route.writes[0].key, url);
  assert.equal(route.writes[0].bytes.toString(), "fresh tile");
});

test("tile cache hits avoid storage and different versions keep distinct keys", async () => {
  const route = createRoute(new Response("cached tile"));
  for (const version of [229, 230]) {
    const url = `https://drawandseek.test/api/tiles/0/0/0?v=${version}`;
    const response = await route.GET(new Request(url), params);
    assert.equal(response.status, 200);
    assert.equal(route.keys.at(-1), url);
  }
  assert.equal(route.downloads(), 0);
  assert.equal(route.after.length, 0);
});
