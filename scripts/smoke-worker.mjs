import assert from "node:assert/strict";
import { cpSync } from "node:fs";
import { checkSeo } from "./check-seo.mjs";

// Mirror OpenNext preview/deploy: expose the build-time cache through Static Assets.
cpSync(
  new URL("../.open-next/cache/", import.meta.url),
  new URL("../.open-next/assets/cdn-cgi/_next_cache/", import.meta.url),
  { recursive: true },
);

process.env.WRANGLER_SEND_METRICS = "false";
const { createTestHarness } = await import("wrangler");
const server = createTestHarness({
  workers: [{
    configPath: "./wrangler.jsonc",
    // Every credential is fake. This check never reads or writes production data.
    secrets: {
      SUPABASE_URL: "https://unused.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "smoke-test-key",
      ADMIN_SLUG: "smoke-admin",
      ADMIN_PASSWORD: "smoke-password",
    },
  }],
});

try {
  await server.listen();
  const env = await server.getWorker().getEnv();
  assert.equal(env.ADMIN_SLUG, "smoke-admin");
  const fetchWorker = (path, init = {}) => server.fetch(`https://drawandseek.test${path}`, {
    ...init,
    headers: { ...init.headers, host: "drawandseek.test" },
  });
  const home = await fetchWorker("/");
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Draw &amp; Seek|Draw & Seek/);
  assert.match(html, /adsbygoogle\.js\?client=ca-pub-7669669855204826/);
  assert.equal((await fetchWorker("/history")).status, 200);
  await checkSeo(fetchWorker);
  assert.equal((await fetchWorker("/admin-console")).status, 404);
  assert.equal((await fetchWorker("/api/admin-console/drawings")).status, 404);
  for (const path of ["/api/drawings", "/api/find"]) {
    assert.equal((await fetchWorker(path, { method: "POST", body: "{}" })).status, 400);
  }
  const login = await fetchWorker("/api/smoke-admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "smoke-password" }),
  });
  if (login.status !== 200) {
    console.log({ adminPageStatus: (await fetchWorker("/smoke-admin")).status, loginStatus: login.status });
    server.debug();
  }
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie") ?? "", /das_admin=.*HttpOnly/);
  console.log("Worker smoke checks passed: localized home/history, sitemap, AdSense, private routes, validation, admin login.");
} finally {
  await server.close();
}
