import { initializeImageEngine } from "./engine.ts";
import { createClient } from "@supabase/supabase-js";
import { createImageHandler } from "./handler.ts";

const wasm = await Deno.readFile(new URL("./magick.wasm", import.meta.url));
await initializeImageEngine(wasm);

const url = Deno.env.get("SUPABASE_URL") ?? "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!url || !secret) throw new Error("Supabase service configuration missing");
const bucket = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from("canvas");

Deno.serve(createImageHandler({
  async download(key) {
    const { data, error } = await bucket.download(key);
    if (error) {
      if ("statusCode" in error && String(error.statusCode) === "404") return null;
      // Storage returns 400 for missing objects as well.
      if (error.message === "Object not found") return null;
      throw new Error(`Storage download failed: ${key}`);
    }
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  },
  async upload(key, bytes, contentType) {
    const { error } = await bucket.upload(key, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Storage upload failed: ${key}`);
  },
}, secret));
