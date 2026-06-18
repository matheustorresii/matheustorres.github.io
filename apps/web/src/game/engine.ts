import type { DraftSquad } from "@11a3/domain";
import {
  createRng,
  seedFrom,
  strengthOf,
  attackModFromComp,
  simulateTournament,
  DEFAULT_TOURNAMENT,
  DEFAULT_ROUND_CAMPAIGN,
  type MatchResult,
  type SimTeam,
  type TournamentResult,
} from "@11a3/sim";
import type { Pick } from "./types.js";

export const USER_ID = "YOU";

/** The tuned round model the campaign plays with (see sim config). */
export const CAMPAIGN_ROUND = DEFAULT_ROUND_CAMPAIGN;

export interface Campaign {
  seed: string;
  userTeam: SimTeam;
  result: TournamentResult;
  userMatches: MatchResult[];
  advanced: boolean; // reached playoffs
  finalPlace: string;
}

/** Random textual seed like "PT94JE". */
export function randomSeedText(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function shuffle<T>(arr: T[], rng: { next: () => number }): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const squadStrength = (s: DraftSquad) => strengthOf(s.players.map((p) => p.overall));

/**
 * Build the user's team (the drafted 5) and 15 historical squads, then run a
 * full Champions-style tournament. Deterministic given the seed + roster.
 */
export function runCampaign(
  picks: Pick[],
  pool: DraftSquad[],
  seed: string,
  teamName = "Seu time",
): Campaign {
  const rng = createRng(seedFrom(seed + picks.map((p) => p.player.playerId).join(",")));

  const rw = CAMPAIGN_ROUND.sideRoleWeight;
  const qw = CAMPAIGN_ROUND.sideQualityWeight;
  const userTeam: SimTeam = {
    id: USER_ID,
    name: teamName,
    tag: "YOU",
    strength: strengthOf(picks.map((p) => p.player.overall)),
    // Side bias from the roles you SLOTTED them in + how good each side is.
    attackMod: attackModFromComp(
      picks.map((p) => ({ role: p.role, overall: p.player.overall })),
      rw,
      qw,
    ),
  };

  const opponents = shuffle(pool, rng)
    .slice(0, 15)
    .map((s) => ({
      id: s.key,
      name: `${s.teamName} '${String(s.year).slice(2)}`,
      tag: s.teamTag,
      strength: squadStrength(s),
      attackMod: attackModFromComp(s.players, rw, qw),
    }));

  const teams = shuffle([userTeam, ...opponents], rng);
  const cfg = { ...DEFAULT_TOURNAMENT, round: CAMPAIGN_ROUND };
  const result = simulateTournament(teams, cfg, CAMPAIGN_ROUND, rng);

  const userMatches = result.matches.filter(
    (m) => m.teamA.id === USER_ID || m.teamB.id === USER_ID,
  );
  const standing = result.standings.find((s) => s.team.id === USER_ID);
  const advanced = result.seeds.some((t) => t.id === USER_ID);

  return {
    seed,
    userTeam,
    result,
    userMatches,
    advanced,
    finalPlace: standing?.placeLabel ?? "Fase de grupos",
  };
}
