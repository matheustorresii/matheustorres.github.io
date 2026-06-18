import type { RoundParams, TournamentConfig } from "./config.js";
import type { SeriesResult, SimTeam } from "./types.js";
import type { Rng } from "./rng.js";
import { simulateSeries } from "./series.js";

export interface MatchResult {
  id: string; // e.g. "UQF1", "GF", "G1-D"
  stage: string; // human label, e.g. "Upper QF", "Decisão"
  /** Global ordering for progressive reveal (groups 0-2, playoffs 3-8). */
  stageRank: number;
  /** Group index (0-based) for group-stage matches, undefined for playoffs. */
  group?: number;
  teamA: SimTeam;
  teamB: SimTeam;
  winner: SimTeam;
  loser: SimTeam;
  series: SeriesResult;
}

export interface GroupRow {
  team: SimTeam;
  record: string; // e.g. "2-0"
  advanced: boolean;
  rank: number; // 1..4 within the group
}

export interface TournamentResult {
  groups: GroupRow[][];
  seeds: SimTeam[];
  matches: MatchResult[];
  champion: SimTeam;
  runnerUp: SimTeam;
  /** Final placement: index 0 = 1st. Ties (5-6th, 7-8th) share order arbitrarily. */
  standings: { team: SimTeam; placeLabel: string }[];
}

interface PlayArgs {
  id: string;
  stage: string;
  stageRank: number;
  group?: number;
  a: SimTeam;
  b: SimTeam;
  bestOf: number;
}

function play(
  args: PlayArgs,
  cfg: TournamentConfig,
  params: RoundParams,
  rng: Rng,
  matches: MatchResult[],
): MatchResult {
  const series = simulateSeries(args.a, args.b, args.bestOf, cfg.mapPool, params, rng);
  const winner = series.winner === "a" ? args.a : args.b;
  const loser = series.winner === "a" ? args.b : args.a;
  const m: MatchResult = {
    id: args.id,
    stage: args.stage,
    stageRank: args.stageRank,
    group: args.group,
    teamA: args.a,
    teamB: args.b,
    winner,
    loser,
    series,
  };
  matches.push(m);
  return m;
}

/**
 * GSL group format (like VCT): 4 teams, double-elim within the group.
 *   Abertura: 1v4, 2v3 → Vencedores (winners) and Eliminação (losers)
 *   Vencedores winner = 2-0, advances. Eliminação loser = 0-2, out.
 *   Decisão: loser(Vencedores) vs winner(Eliminação) → winner 2-1 advances, loser 1-2 out.
 * Top 2 of each group advance.
 */
export function simulateGroups(
  teams: SimTeam[],
  cfg: TournamentConfig,
  params: RoundParams,
  rng: Rng,
  matches: MatchResult[],
): GroupRow[][] {
  const { count, teamsPerGroup } = cfg.groups;
  const bo = cfg.bestOf.groups;
  const tables: GroupRow[][] = [];

  for (let g = 0; g < count; g++) {
    const groupTeams = teams.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup);
    if (groupTeams.length !== 4) {
      throw new Error("GSL groups require exactly 4 teams per group");
    }
    const G = g + 1;
    const [s0, s1, s2, s3] = [...groupTeams].sort((a, b) => b.strength - a.strength) as [
      SimTeam, SimTeam, SimTeam, SimTeam,
    ];
    const mk = (id: string, stage: string, stageRank: number, a: SimTeam, b: SimTeam) =>
      play({ id, stage, stageRank, group: g, a, b, bestOf: bo }, cfg, params, rng, matches);

    const oa = mk(`G${G}-OA`, "Abertura", 0, s0, s3);
    const ob = mk(`G${G}-OB`, "Abertura", 0, s1, s2);
    const win = mk(`G${G}-W`, "Vencedores", 1, oa.winner, ob.winner);
    const elim = mk(`G${G}-E`, "Eliminação", 1, oa.loser, ob.loser);
    const dec = mk(`G${G}-D`, "Decisão", 2, win.loser, elim.winner);

    tables.push([
      { team: win.winner, record: "2-0", advanced: true, rank: 1 },
      { team: dec.winner, record: "2-1", advanced: true, rank: 2 },
      { team: dec.loser, record: "1-2", advanced: false, rank: 3 },
      { team: elim.loser, record: "0-2", advanced: false, rank: 4 },
    ]);
  }

  return tables;
}

/** Seed order: all group winners (rank 1) in group order, then all runners-up (rank 2). */
export function seedsFromGroups(tables: GroupRow[][], cfg: TournamentConfig): SimTeam[] {
  const seeds: SimTeam[] = [];
  for (let pos = 0; pos < cfg.groups.advancePerGroup; pos++) {
    for (const table of tables) {
      const row = table[pos];
      if (row) seeds.push(row.team);
    }
  }
  return seeds.slice(0, cfg.playoffSize);
}

/**
 * Canonical 8-team double elimination. Upper QF pairings (1v8, 4v5, 2v7, 3v6)
 * keep the top two seeds in opposite halves and avoid same-group rematches when
 * fed by seedsFromGroups. Grand final is MD5.
 */
export function simulateDoubleElim8(
  seeds: SimTeam[],
  cfg: TournamentConfig,
  params: RoundParams,
  rng: Rng,
  matches: MatchResult[],
): { champion: SimTeam; runnerUp: SimTeam; standings: TournamentResult["standings"] } {
  if (seeds.length !== 8) throw new Error(`double elim needs 8 seeds, got ${seeds.length}`);
  const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds as [
    SimTeam, SimTeam, SimTeam, SimTeam, SimTeam, SimTeam, SimTeam, SimTeam,
  ];
  const bo = cfg.bestOf;
  const up = (id: string, st: string, rank: number, a: SimTeam, b: SimTeam) =>
    play({ id, stage: st, stageRank: rank, a, b, bestOf: bo.upper }, cfg, params, rng, matches);
  const lo = (id: string, st: string, rank: number, a: SimTeam, b: SimTeam) =>
    play({ id, stage: st, stageRank: rank, a, b, bestOf: bo.lower }, cfg, params, rng, matches);

  // Upper bracket
  const uqf1 = up("UQF1", "Upper QF", 3, s1, s8);
  const uqf2 = up("UQF2", "Upper QF", 3, s4, s5);
  const uqf3 = up("UQF3", "Upper QF", 3, s2, s7);
  const uqf4 = up("UQF4", "Upper QF", 3, s3, s6);
  const usf1 = up("USF1", "Upper SF", 4, uqf1.winner, uqf2.winner);
  const usf2 = up("USF2", "Upper SF", 4, uqf3.winner, uqf4.winner);
  const uf = up("UF", "Upper Final", 5, usf1.winner, usf2.winner);

  // Lower bracket
  const lr1a = lo("LR1A", "Lower R1", 4, uqf1.loser, uqf2.loser);
  const lr1b = lo("LR1B", "Lower R1", 4, uqf3.loser, uqf4.loser);
  const lr2a = lo("LR2A", "Lower R2", 5, lr1a.winner, usf2.loser);
  const lr2b = lo("LR2B", "Lower R2", 5, lr1b.winner, usf1.loser);
  const lr3 = lo("LR3", "Lower SF", 6, lr2a.winner, lr2b.winner);
  const lf = play(
    { id: "LF", stage: "Lower Final", stageRank: 7, a: lr3.winner, b: uf.loser, bestOf: bo.lowerFinal },
    cfg,
    params,
    rng,
    matches,
  );

  // Grand final (MD5)
  const gf = play(
    { id: "GF", stage: "Grande Final", stageRank: 8, a: uf.winner, b: lf.winner, bestOf: bo.grandFinal },
    cfg,
    params,
    rng,
    matches,
  );

  const standings: TournamentResult["standings"] = [
    { team: gf.winner, placeLabel: "Campeão" },
    { team: gf.loser, placeLabel: "Vice" },
    { team: lf.loser, placeLabel: "3º" },
    { team: lr3.loser, placeLabel: "4º" },
    { team: lr2a.loser, placeLabel: "5º–6º" },
    { team: lr2b.loser, placeLabel: "5º–6º" },
    { team: lr1a.loser, placeLabel: "7º–8º" },
    { team: lr1b.loser, placeLabel: "7º–8º" },
  ];

  return { champion: gf.winner, runnerUp: gf.loser, standings };
}

/** Full tournament: GSL groups -> seeds -> 8-team double elim. */
export function simulateTournament(
  teams: SimTeam[],
  cfg: TournamentConfig,
  params: RoundParams,
  rng: Rng,
): TournamentResult {
  const matches: MatchResult[] = [];
  const groups = simulateGroups(teams, cfg, params, rng, matches);
  const seeds = seedsFromGroups(groups, cfg);
  const { champion, runnerUp, standings } = simulateDoubleElim8(seeds, cfg, params, rng, matches);
  return { groups, seeds, matches, champion, runnerUp, standings };
}
