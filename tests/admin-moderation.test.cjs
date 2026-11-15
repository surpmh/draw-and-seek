const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadRoute(relativePath, mocks) {
  const filename = path.join(__dirname, "..", relativePath);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console, Buffer, URL,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  }, { filename });
  return module.exports;
}

const drawingId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const createdAt = "2026-11-01T00:00:00.000Z";
const foundAt = "2026-11-02T00:00:00.000Z";
const removedAt = "2026-11-03T00:00:00.000Z";
const drawing = (n, overrides = {}) => ({
  id: drawingId(n), nickname: `artist ${n}`, device_id: drawingId(999),
  created_at: createdAt, found_at: foundAt, removed_at: null,
  x: 100, y: 100, w: 32, h: 32, image_path: `${drawingId(n)}.png`, ...overrides,
});

// Exercise the real handlers against isolated rows; tests never contact the live DB or Storage.
function fixture(drawings, reports = []) {
  const tables = { drawings, reports };
  let composites = 0;
  let downloads = 0;
  const db = {
    from(table) {
      const filters = [];
      const orders = [];
      let range;
      let update;
      let single = false;
      const query = {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { filters.push((row) => row[key] === value); return this; },
        not(key, _operator, value) { filters.push((row) => row[key] !== value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        order(key, { ascending }) { orders.push({ key, ascending }); return this; },
        range(start, end) { range = [start, end]; return this; },
        limit(count) { range = [0, count - 1]; return this; },
        update(values) { update = values; return this; },
        maybeSingle() { single = true; return this; },
        then(resolve, reject) {
          let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          const count = rows.length;
          if (update) rows.forEach((row) => Object.assign(row, update));
          rows.sort((a, b) => {
            for (const { key, ascending } of orders) {
              if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          if (range) rows = rows.slice(range[0], range[1] + 1);
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, count, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name) { assert.equal(name, "bump_canvas_version"); return { data: composites, error: null }; },
  };
  const mocks = {
    "@/lib/supabase": { getServiceClient: () => db },
    "@/lib/admin-auth": { isAdminRequest: (req) => req.headers.get("x-test-admin") === "yes" },
    "@/lib/canvas-meta": { readTilesetMeta: async () => ({}) },
    "@/lib/composite": {
      tilesForBbox: () => [],
      async recompositeTiles() { composites++; },
    },
    "@/lib/storage": { async storageDownload() { downloads++; return Buffer.from("thumbnail"); } },
    "@/lib/image-service": {},
  };
  const list = loadRoute("app/api/admin-console/drawings/route.ts", mocks);
  const moderation = loadRoute("app/api/admin-console/drawings/[id]/route.ts", mocks);
  const thumb = loadRoute("app/api/drawings/[id]/thumb/route.ts", mocks);
  return {
    list, moderation, thumb,
    get composites() { return composites; },
    get downloads() { return downloads; },
    request(search = "", authorized = true) {
      return new Request(`http://localhost/api/test-admin/drawings${search}`, {
        headers: authorized ? { "x-test-admin": "yes" } : {},
      });
    },
    params(id) { return { params: Promise.resolve({ id }) }; },
  };
}

test("found list paginates all discovered drawings and excludes hidden and removed rows", async () => {
  const f = fixture([
    ...Array.from({ length: 25 }, (_, i) => drawing(i + 1)),
    drawing(26, { found_at: null }), drawing(27, { removed_at: removedAt }),
  ]);
  const first = await f.list.GET(f.request("?status=found"));
  const page1 = await first.json();
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(page1.total, 25);
  assert.equal(page1.items.length, 20);
  assert.equal(page1.items[0].id, drawingId(25));
  assert.equal(page1.items[0].foundAt, foundAt);
  const page2 = await (await f.list.GET(f.request("?status=found&page=2"))).json();
  assert.equal(page2.items.length, 5);
  assert.equal(page2.items[0].id, drawingId(5));
  assert.equal(page2.page, 2);
  const ids = [...page1.items, ...page2.items].map((row) => row.id);
  assert.equal(new Set(ids).size, 25);
});

test("found list shows the most recently discovered drawing first and normalizes invalid pages", async () => {
  const f = fixture([drawing(1), drawing(2, { found_at: removedAt })]);
  for (const page of ["-1", "1.5", "Infinity", "nope"]) {
    const result = await (await f.list.GET(f.request(`?status=found&page=${page}`))).json();
    assert.equal(result.page, 1);
    assert.equal(result.items[0].id, drawingId(2));
  }
});

test("history reports include discovery state in the admin inbox", async () => {
  const f = fixture([drawing(1)], [{ drawing_id: drawingId(1), reason: "hate", created_at: removedAt, dismissed_at: null }]);
  const result = await (await f.list.GET(f.request("?status=reported"))).json();
  assert.equal(result[0].foundAt, foundAt);
  assert.equal(result[0].reportCount, 1);
  assert.equal(result[0].reasons.hate, 1);
});

test("deleting and restoring a found drawing preserves discovery and never puts it back on the canvas", async () => {
  const row = drawing(1);
  const report = { drawing_id: row.id, reason: "hate", created_at: removedAt, dismissed_at: null };
  const f = fixture([row], [report]);
  const response = await f.moderation.DELETE(f.request(), f.params(row.id));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).version, null);
  assert.ok(row.removed_at);
  assert.equal(row.found_at, foundAt);
  assert.equal((await (await f.list.GET(f.request("?status=found"))).json()).total, 0);
  assert.equal((await (await f.list.GET(f.request("?status=reported"))).json()).length, 0);
  assert.equal((await f.thumb.GET(f.request(), f.params(row.id))).status, 404);
  assert.equal(f.downloads, 0);
  assert.equal((await f.moderation.POST(f.request(), f.params(row.id))).status, 200);
  assert.equal(row.removed_at, null);
  assert.equal(row.found_at, foundAt);
  assert.ok(report.dismissed_at);
  assert.equal((await (await f.list.GET(f.request("?status=hidden"))).json()).length, 0);
  assert.equal((await (await f.list.GET(f.request("?status=found"))).json()).total, 1);
  assert.equal(f.composites, 0);
});

test("hidden drawings still return to the canvas after deletion and restoration", async () => {
  const row = drawing(1, { found_at: null });
  const f = fixture([row]);
  assert.equal((await f.moderation.DELETE(f.request(), f.params(row.id))).status, 200);
  assert.equal(row.found_at, row.removed_at);
  assert.equal((await f.moderation.POST(f.request(), f.params(row.id))).status, 200);
  assert.equal(row.found_at, null);
  assert.equal(row.removed_at, null);
  assert.equal(f.composites, 2);
});

test("admin lists, deletion, and restoration reject unauthenticated requests", async () => {
  const row = drawing(1);
  const f = fixture([row]);
  assert.equal((await f.list.GET(f.request("?status=found", false))).status, 401);
  for (const method of ["DELETE", "POST"]) {
    assert.equal((await f.moderation[method](f.request("", false), f.params(row.id))).status, 401);
  }
  assert.equal(row.removed_at, null);
});

test("public thumbnails require a fresh moderation check on every request", async () => {
  const row = drawing(1);
  const f = fixture([row]);
  const response = await f.thumb.GET(f.request(), f.params(row.id));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.downloads, 1);
  row.removed_at = removedAt;
  assert.equal((await f.thumb.GET(f.request(), f.params(row.id))).status, 404);
  assert.equal(f.downloads, 1);
});
