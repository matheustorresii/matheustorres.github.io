import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { CATALOG_FILE, STATUS_FILE, DATA_DIR } from "./paths.js";
import { ingestEvent, writeEventFile, type CatalogEntry } from "./ingest.js";
import { rebuildIndexes, ensureWebDataLink } from "./indexes.js";

type Status = "discovered" | "approved" | "ingested" | "failed";
type StatusMap = Record<string, { status: Status; updatedAt: string; warnings?: string[] }>;

function loadCatalog(): (CatalogEntry & { status?: string })[] {
  return JSON.parse(readFileSync(CATALOG_FILE, "utf8"));
}
function loadStatus(): StatusMap {
  return existsSync(STATUS_FILE) ? JSON.parse(readFileSync(STATUS_FILE, "utf8")) : {};
}
function saveStatus(s: StatusMap): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2), "utf8");
}

function printStatus(catalog: (CatalogEntry & { status?: string })[], status: StatusMap) {
  console.log("\nEvento                          id     catálogo    ingestão");
  console.log("─".repeat(64));
  for (const e of catalog) {
    const id = String(e.event_id);
    const ing = status[id]?.status ?? "—";
    console.log(
      `${e.name.padEnd(30)}  ${id.padEnd(5)}  ${(e.status ?? "?").padEnd(10)}  ${ing}`,
    );
  }
  console.log("");
}

async function ingestOne(entry: CatalogEntry, status: StatusMap): Promise<boolean> {
  const id = String(entry.event_id);
  console.log(`\n▶ Ingerindo ${entry.name} (event ${id})`);
  try {
    const { file, warnings } = await ingestEvent(entry);
    const path = writeEventFile(file);
    console.log(
      `  ✓ ${file.stats.length} jogadores, ${file.teams.length} times, ${file.placements.filter((p) => p.tier !== "groups").length} colocações → ${path}`,
    );
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    status[id] = { status: "ingested", updatedAt: new Date().toISOString(), warnings };
    return true;
  } catch (err) {
    console.error(`  ✗ falhou: ${(err as Error).message}`);
    status[id] = { status: "failed", updatedAt: new Date().toISOString() };
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const catalog = loadCatalog();
  const status = loadStatus();

  if (args.length === 0 || args[0] === "status") {
    printStatus(catalog, status);
    console.log("Uso: npm run ingest -- <event_id> | all | status");
    return;
  }

  let targets: CatalogEntry[];
  if (args[0] === "all") {
    targets = catalog;
  } else {
    targets = catalog.filter((e) => args.includes(String(e.event_id)));
    if (targets.length === 0) {
      console.error(`Nenhum evento no catálogo com id(s): ${args.join(", ")}`);
      process.exit(1);
    }
  }

  for (const entry of targets) {
    await ingestOne(entry, status);
    saveStatus(status);
  }

  rebuildIndexes();
  ensureWebDataLink();
  console.log("\n✓ Índices reconstruídos. Status salvo.\n");
  printStatus(catalog, status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
