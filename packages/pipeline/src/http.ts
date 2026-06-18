import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { CACHE_DIR } from "./paths.js";

const USER_AGENT =
  "11a3-research/0.1 (personal fantasy project; respectful, cached, rate-limited)";
const MIN_INTERVAL_MS = 2500; // be polite: >= 2.5s between live requests

let lastFetch = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cachePath(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex");
  return resolve(CACHE_DIR, `${hash}.html`);
}

/**
 * Fetch a URL with a local disk cache as the source of truth. A cached page is
 * never re-downloaded, so re-running the pipeline (e.g. after a parser change)
 * is fully offline. Live requests are serialized and rate-limited.
 */
export async function fetchCached(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(url);
  if (existsSync(file)) {
    return readFileSync(file, "utf8");
  }

  const wait = MIN_INTERVAL_MS - (Date.now() - lastFetch);
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();

  console.log(`  ↓ fetching ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  writeFileSync(file, html, "utf8");
  return html;
}
