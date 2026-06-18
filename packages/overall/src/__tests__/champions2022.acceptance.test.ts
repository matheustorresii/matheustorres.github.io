import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { EventFile } from "@11a3/domain";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENT_FILE = resolve(__dirname, "../../../../data/events/1015.json");

// VLR player ids (stable). From /player/8549/kingg and /player/683/pancada.
const KINGG_ID = "8549";
const PANCADA_ID = "683";

describe("Champions 2022 (event 1015) — overall acceptance", () => {
  it("has been ingested (run `npm run ingest -- 1015` first)", () => {
    expect(
      existsSync(EVENT_FILE),
      `Missing ${EVENT_FILE}. Ingest event 1015 before running this test.`,
    ).toBe(true);
  });

  it("pAncada (LOUD champion) outranks kiNgg (best R2.0, eliminated earlier)", () => {
    const event = JSON.parse(readFileSync(EVENT_FILE, "utf8")) as EventFile;

    const pancada = event.cards.find((c) => c.playerId === PANCADA_ID);
    const kingg = event.cards.find((c) => c.playerId === KINGG_ID);

    expect(pancada, "pAncada card not found").toBeDefined();
    expect(kingg, "kiNgg card not found").toBeDefined();

    // Sanity: kiNgg really did have the higher individual rating.
    const kinggStats = event.stats.find((s) => s.playerId === KINGG_ID)!;
    const pancadaStats = event.stats.find((s) => s.playerId === PANCADA_ID)!;
    expect(kinggStats.r20).toBeGreaterThan(pancadaStats.r20);

    // The core requirement: the champion's player must rank higher overall.
    expect(pancada!.overall).toBeGreaterThan(kingg!.overall);
  });
});
