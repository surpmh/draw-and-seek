const assert = require("node:assert/strict");
const { test } = require("node:test");
const { chromium } = require("playwright");
const sharp = require("sharp");

// Run against a local dev server. All API and external requests are intercepted.
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";

for (const width of [1440, 390]) {
  test(`${width}px: uploaded drawing remains visible until refreshed tiles load`, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "ko-KR" });
    await context.addInitScript(() => localStorage.setItem("das_empty_dismissed", "1"));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    const diagnostics = [];
    page.on("console", (msg) => { if (msg.type() === "error") diagnostics.push(msg.text()); });
    page.on("requestfailed", (req) => diagnostics.push(`${req.url()}: ${req.failure()?.errorText}`));
    page.on("pageerror", (error) => errors.push(error.message));
    const tile = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
    let version = 1;
    let saved = false;
    let failUpload = true;
    let failList = false;
    let notifyFreshTile;
    const freshTileStarted = new Promise((resolve) => { notifyFreshTile = resolve; });
    let releaseTiles;
    const tilesReady = new Promise((resolve) => { releaseTiles = resolve; });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL).origin) return route.abort();
      if (url.pathname === "/api/canvas") return route.fulfill({ json: { width: 4096, height: 4096, tileSize: 512, maxZoom: 3, version, remainCount: saved ? 1 : 0 } });
      if (url.pathname === "/api/drawings" && route.request().method() === "POST") {
        if (failUpload) { failUpload = false; return route.fulfill({ status: 502, body: "Test upload failure" }); }
        saved = true;
        return route.fulfill({ json: { id: "saved-drawing" } });
      }
      if (url.pathname === "/api/drawings") {
        if (failList) return route.fulfill({ status: 500, body: "Test list failure" });
        return route.fulfill({ json: saved ? [{ id: "saved-drawing", nickname: "Anonymous", hiddenMs: 0, thumbnailUrl: "/api/drawings/saved-drawing/thumb", isMine: true }] : [] });
      }
      if (url.pathname === "/api/find") {
        saved = false;
        return route.fulfill({ json: { found: true, nickname: "Anonymous", hiddenMs: 1000 } });
      }
      if (url.pathname.startsWith("/api/tiles/")) {
        if (url.searchParams.get("v") === "2") { notifyFreshTile(); await tilesReady; }
        return route.fulfill({ contentType: "image/png", body: tile });
      }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "image/png", body: tile });
      return route.continue();
    });
    const drawAndUpload = async () => {
      if (width < 768) {
        await page.getByRole("button", { name: "✏️ 그리기", exact: true }).click();
        await page.waitForTimeout(550);
      }
      const pad = await page.locator("canvas").first().boundingBox();
      await page.mouse.move(pad.x + pad.width * .2, pad.y + pad.height * .2);
      await page.mouse.down();
      for (const [x, y] of [[.8, .2], [.8, .8], [.2, .8], [.2, .2]]) {
        await page.mouse.move(pad.x + pad.width * x, pad.y + pad.height * y, { steps: 5 });
      }
      await page.mouse.up();
      await page.getByRole("button", { name: /Upload/ }).click();
    };
    try {
      await page.goto(baseURL);
      await page.locator("canvas").first().waitFor();
      await page.waitForTimeout(600);
      await drawAndUpload();
      const step = page.locator('[data-screen-label="Upload Step"]');
      await step.waitFor();
      const complete = step.getByRole("button", { name: "Complete", exact: true });
      await complete.click();
      await page.getByText(/Test upload failure/).waitFor();
      assert.equal(await page.locator("[data-resize-corner]").count(), 4, "failed upload keeps editable placement");
      await complete.click();
      await step.waitFor({ state: "detached" });
      const preview = page.locator('[data-screen-label="Canvas"] img[src^="data:image/png"]');
      assert.equal(await preview.count(), 1, "saved drawing must remain visible before server recomposition");
      assert.equal(await page.locator("[data-resize-corner]").count(), 0, "saved drawing has no editing handles");
      await page.waitForTimeout(500);
      assert.equal(await preview.count(), 1);
      version = 2;
      await page.waitForRequest((req) => req.url().includes("/api/tiles/") && new URL(req.url()).searchParams.get("v") === "2");
      await freshTileStarted;
      assert.equal(await preview.count(), 1, "a version change alone must not remove the drawing while tiles are loading");
      releaseTiles();
      await preview.waitFor({ state: "detached" });

      // A failed list refresh must not erase a second saved preview. A successful
      // find must still reach the canvas and remove it before recomposition ends.
      await drawAndUpload();
      await step.waitFor();
      failList = true;
      const failedListResponse = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/drawings" && res.status() === 500);
      await complete.click();
      await step.waitFor({ state: "detached" });
      await failedListResponse;
      assert.equal(await preview.count(), 1, "a failed list refresh must preserve the saved drawing");
      assert.equal(await preview.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
      failList = false;
      const p = await preview.boundingBox();
      await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
      await preview.waitFor({ state: "detached" });
      assert.equal(saved, false, "the saved preview must allow find gestures through to the canvas");
      version = 3;
      assert.deepEqual(errors, []);
    } catch (error) {
      console.error({ width, errors, diagnostics, text: (await page.locator("body").innerText()).slice(0, 1600) });
      throw error;
    } finally {
      releaseTiles();
      await browser.close();
    }
  });
}
