import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// packages/pipeline/src -> repo root is three levels up.
const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "../../..");

export const DATA_DIR = resolve(REPO_ROOT, "data");
export const CACHE_DIR = resolve(DATA_DIR, "cache");
export const EVENTS_DIR = resolve(DATA_DIR, "events");
export const PLAYERS_DIR = resolve(DATA_DIR, "players");
export const CATALOG_FILE = resolve(REPO_ROOT, "events_catalog.json");
export const STATUS_FILE = resolve(DATA_DIR, "ingest_status.json");
export const INDEX_FILE = resolve(DATA_DIR, "index.json");

export const PIPELINE_VERSION = "0.1.0";
