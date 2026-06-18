import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import type {
  DraftSquad,
  EventFile,
  EventIndexEntry,
  Role,
} from "@11a3/domain";
import {
  DATA_DIR,
  EVENTS_DIR,
  PLAYERS_DIR,
  INDEX_FILE,
  REPO_ROOT,
} from "./paths.js";

const DRAFT_POOL_FILE = resolve(DATA_DIR, "draft_pool.json");
const MIN_SQUAD_SIZE = 5; // a roll must show a full team

interface PlayerAppearance {
  eventId: string;
  eventName: string;
  year: number;
  teamTag: string;
  role: Role;
  overall: number;
}
interface PlayerIndexEntry {
  id: string;
  handle: string;
  displayName: string;
  appearances: PlayerAppearance[];
}

function loadAllEvents(): EventFile[] {
  if (!existsSync(EVENTS_DIR)) return [];
  return readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(resolve(EVENTS_DIR, f), "utf8")) as EventFile);
}

/** Rebuild data/index.json and data/players/index.json from all event files. */
export function rebuildIndexes(): void {
  const events = loadAllEvents();

  const index: EventIndexEntry[] = events
    .map((e) => ({
      id: e.event.id,
      name: e.event.name,
      year: e.event.year,
      type: e.event.type,
    }))
    .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");

  const players = new Map<string, PlayerIndexEntry>();
  for (const e of events) {
    const playerById = new Map(e.players.map((p) => [p.id, p]));
    for (const card of e.cards) {
      const p = playerById.get(card.playerId);
      if (!p) continue;
      if (!players.has(p.id)) {
        players.set(p.id, {
          id: p.id,
          handle: p.handle,
          displayName: p.displayName,
          appearances: [],
        });
      }
      players.get(p.id)!.appearances.push({
        eventId: e.event.id,
        eventName: e.event.name,
        year: e.event.year,
        teamTag: card.teamTag,
        role: card.role,
        overall: card.overall,
      });
    }
  }
  for (const p of players.values()) {
    p.appearances.sort((a, b) => b.year - a.year || b.overall - a.overall);
  }
  mkdirSync(PLAYERS_DIR, { recursive: true });
  writeFileSync(
    resolve(PLAYERS_DIR, "index.json"),
    JSON.stringify([...players.values()].sort((a, b) => a.handle.localeCompare(b.handle)), null, 2),
    "utf8",
  );

  writeFileSync(DRAFT_POOL_FILE, JSON.stringify(buildDraftPool(events), null, 2), "utf8");
}

const ROLES: Role[] = ["duelist", "initiator", "controller", "sentinel"];

/**
 * Pick the 5 players to show for a squad: cover each role the team has (best
 * overall per role), then fill the rest by overall. Guarantees role diversity so
 * a draft can't brick on a missing role when the roster actually has one.
 */
function pickStarters(players: DraftSquad["players"]): DraftSquad["players"] {
  const byOverall = [...players].sort((a, b) => b.overall - a.overall);
  const chosen: DraftSquad["players"] = [];
  for (const role of ROLES) {
    const best = byOverall.find((p) => p.role === role && !chosen.includes(p));
    if (best) chosen.push(best);
  }
  for (const p of byOverall) {
    if (chosen.length >= 5) break;
    if (!chosen.includes(p)) chosen.push(p);
  }
  return chosen.slice(0, 5);
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** One squad per (event, team) with >= 5 players — the roll units for the draft. */
function buildDraftPool(events: EventFile[]): DraftSquad[] {
  const squads: DraftSquad[] = [];
  for (const e of events) {
    const playerById = new Map(e.players.map((p) => [p.id, p]));
    const teamByTag = new Map(e.teams.map((t) => [t.tag, t]));
    const byTag = new Map<string, DraftSquad>();

    for (const card of e.cards) {
      const p = playerById.get(card.playerId);
      const team = teamByTag.get(card.teamTag);
      if (!p || !team) continue;
      if (!byTag.has(card.teamTag)) {
        byTag.set(card.teamTag, {
          key: `${e.event.id}:${card.teamTag}`,
          eventId: e.event.id,
          eventName: e.event.name,
          year: e.event.year,
          type: e.event.type,
          teamTag: card.teamTag,
          teamName: team.name,
          teamKey: normKey(team.name),
          players: [],
        });
      }
      byTag.get(card.teamTag)!.players.push({
        playerId: p.id,
        displayName: p.displayName,
        role: card.role,
        isFlex: card.isFlex,
        rolesPlayed: card.rolesPlayed,
        overall: card.overall,
      });
    }

    for (const squad of byTag.values()) {
      if (squad.players.length >= MIN_SQUAD_SIZE) {
        squad.players = pickStarters(squad.players);
        squads.push(squad);
      }
    }
  }
  return squads;
}

/**
 * Make the web app able to read /data via a symlink in its public dir.
 * Idempotent; safe to call every run.
 */
export function ensureWebDataLink(): void {
  const publicDir = resolve(REPO_ROOT, "apps/web/public");
  mkdirSync(publicDir, { recursive: true });
  const link = resolve(publicDir, "data");
  if (!existsSync(link)) {
    // relative target from apps/web/public -> repo-root/data
    symlinkSync("../../../data", link, "dir");
  }
}
