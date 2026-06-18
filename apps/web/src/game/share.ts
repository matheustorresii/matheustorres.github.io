import type { DraftSquad, Role } from "@11a3/domain";
import type { Pick } from "./types.js";

/**
 * A shareable run = the 5 drafted entries (player at a specific event, in an
 * assigned role) + the campaign seed. Encoded compactly into a URL hash so
 * opening the link rebuilds the exact comp and reproduces the same campaign.
 */
interface RunPayload {
  s: string; // seed
  p: [string, string, Role][]; // [playerId, eventId, role] per slot
}

const toBase64Url = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) =>
  atob(s.replace(/-/g, "+").replace(/_/g, "/"));

export function encodeRun(picks: Pick[], seed: string): string {
  const payload: RunPayload = {
    s: seed,
    p: picks.map((pk) => [pk.player.playerId, pk.squad.eventId, pk.role]),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function shareUrl(picks: Pick[], seed: string): string {
  const code = encodeRun(picks, seed);
  return `${location.origin}${location.pathname}#run=${code}`;
}

export interface DecodedRun {
  seed: string;
  picks: Pick[];
}

/** Rebuild picks from a code using the loaded draft pool. Returns null if invalid. */
export function decodeRun(code: string, pool: DraftSquad[]): DecodedRun | null {
  try {
    const payload = JSON.parse(fromBase64Url(code)) as RunPayload;
    if (!payload.p || !Array.isArray(payload.p)) return null;
    const picks: Pick[] = [];
    for (const [playerId, eventId, role] of payload.p) {
      const squad = pool.find(
        (sq) => sq.eventId === eventId && sq.players.some((pl) => pl.playerId === playerId),
      );
      const player = squad?.players.find((pl) => pl.playerId === playerId);
      if (!squad || !player) return null;
      const slotRole = role && player.rolesPlayed.includes(role) ? role : player.role;
      picks.push({ player, squad, role: slotRole });
    }
    if (picks.length === 0) return null;
    return { seed: payload.s || "", picks };
  } catch {
    return null;
  }
}

/** Read a shared run from the current URL hash, if present. */
export function readRunFromHash(pool: DraftSquad[]): DecodedRun | null {
  const m = location.hash.match(/run=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  return decodeRun(m[1]!, pool);
}
