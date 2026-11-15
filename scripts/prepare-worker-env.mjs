import { stat, writeFile } from "node:fs/promises";

// OpenNext includes .env.local as runtime defaults. Use Worker secrets instead,
// so developer credentials are never shipped inside the deployment artifact.
const target = new URL("../.open-next/cloudflare/next-env.mjs", import.meta.url);
await stat(target);
await writeFile(target, ["production", "development", "test"]
  .map((mode) => `export const ${mode} = {};\n`).join(""));
console.log("Worker runtime variables will be supplied by Cloudflare secrets.");
