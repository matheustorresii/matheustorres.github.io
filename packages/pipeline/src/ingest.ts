import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  EventFile,
  EventType,
  Placement,
  Player,
  PlayerEventStats,
} from "@11a3/domain";
import { computeCards } from "@11a3/overall";
import { fetchCached } from "./http.js";
import { parseStats } from "./parseStats.js";
import { parsePlacements } from "./parsePlacements.js";
import { resolveTeams, matchPlacementsToTeams, assignNonPlacedSlugs } from "./resolveTeams.js";
import { EVENTS_DIR, PIPELINE_VERSION } from "./paths.js";

export interface CatalogEntry {
  name: string;
  year: number;
  type: EventType;
  event_id: number;
  slug: string;
}

export function statsUrl(e: CatalogEntry): string {
  return `https://www.vlr.gg/event/stats/${e.event_id}/${e.slug}`;
}
export function overviewUrl(e: CatalogEntry): string {
  return `https://www.vlr.gg/event/${e.event_id}/${e.slug}`;
}

export interface IngestResult {
  file: EventFile;
  warnings: string[];
}

export async function ingestEvent(entry: CatalogEntry): Promise<IngestResult> {
  const eventId = String(entry.event_id);
  const warnings: string[] = [];

  const statsHtml = await fetchCached(statsUrl(entry));
  const overviewHtml = await fetchCached(overviewUrl(entry));

  const rows = parseStats(statsHtml);
  if (rows.length === 0) warnings.push("no player rows parsed from stats page");

  const rawPlacements = parsePlacements(overviewHtml);
  if (rawPlacements.length === 0)
    warnings.push("no standings parsed from overview page");

  const { teams, candidatesByTag } = resolveTeams(rows, eventId, entry.slug);

  // Placement per team tag (teams not in standings => "groups").
  const rawByTag = matchPlacementsToTeams(teams, rawPlacements, candidatesByTag);
  // Fix display names/slugs for the non-placed teams (unique global assignment).
  assignNonPlacedSlugs(teams, candidatesByTag, new Set(rawByTag.keys()));
  const placements: Placement[] = [];
  const placementByTag = new Map<string, Placement>();
  for (const team of teams) {
    const raw = rawByTag.get(team.tag);
    const placement: Placement = raw
      ? {
          eventId,
          teamTag: team.tag,
          tier: raw.tier,
          rank: raw.rank,
          label: raw.rawLabel,
        }
      : {
          eventId,
          teamTag: team.tag,
          tier: "groups",
          rank: 99,
          label: "groups",
        };
    placements.push(placement);
    placementByTag.set(team.tag, placement);
  }

  // Normalize stats rows + dedup players.
  const players = new Map<string, Player>();
  const stats: PlayerEventStats[] = rows.map((r) => {
    players.set(r.playerId, {
      id: r.playerId,
      handle: r.handle,
      displayName: r.displayName,
    });
    return {
      playerId: r.playerId,
      eventId,
      teamTag: r.teamTag,
      agents: r.agents,
      rounds: r.rounds,
      r20: r.r20,
      acs: r.acs,
      kd: r.kd,
      kast: r.kast,
      adr: r.adr,
      kpr: r.kpr,
      apr: r.apr,
      fkpr: r.fkpr,
      fdpr: r.fdpr,
      hsPct: r.hsPct,
      clPct: r.clPct,
      k: r.k,
      d: r.d,
      a: r.a,
      fk: r.fk,
      fd: r.fd,
    };
  });

  const cards = computeCards(stats, placementByTag);

  const file: EventFile = {
    event: {
      id: eventId,
      slug: entry.slug,
      name: entry.name,
      year: entry.year,
      type: entry.type,
      sourceUrls: { stats: statsUrl(entry), overview: overviewUrl(entry) },
    },
    teams,
    placements,
    players: [...players.values()],
    stats,
    cards,
    meta: { scrapedAt: new Date().toISOString(), pipelineVersion: PIPELINE_VERSION },
  };

  return { file, warnings };
}

export function writeEventFile(file: EventFile): string {
  mkdirSync(EVENTS_DIR, { recursive: true });
  const path = resolve(EVENTS_DIR, `${file.event.id}.json`);
  writeFileSync(path, JSON.stringify(file, null, 2), "utf8");
  return path;
}
