import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = require.resolve("@imagemagick/magick-wasm/magick.wasm");
const target = new URL("../supabase/functions/image-service/magick.wasm", import.meta.url);
await copyFile(source, target);
const shared = new URL("../supabase/functions/image-service/shared/", import.meta.url);
await mkdir(shared, { recursive: true });
// Keep a single source for browser/server ink rules; deploy a self-contained function.
for (const name of ["ink-metrics", "placement", "tiles"]) {
  const original = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const denoSource = original.replace(/from "\.\/(placement|tiles)"/g, 'from "./$1.ts"');
  await writeFile(new URL(`${name}.ts`, shared), denoSource);
}
console.log(`Prepared image-service WASM (${Math.round((await stat(target)).size / 1024)} KiB)`);
