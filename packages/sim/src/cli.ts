import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { EventFile } from "@11a3/domain";
import { createRng, seedFrom } from "./rng.js";
import { strengthOf } from "./strength.js";
import { attackModFromComp } from "./sides.js";
import {
  DEFAULT_TOURNAMENT,
  DEFAULT_ROUND_V1,
  DEFAULT_ROUND_CAMPAIGN,
  type TournamentConfig,
} from "./config.js";
import { simulateTournament, simulateDoubleElim8, type MatchResult } from "./bracket.js";
import type { MapResult, SimTeam } from "./types.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadTeams(
  eventId: string,
  params: { sideRoleWeight: number; sideQualityWeight: number },
): SimTeam[] {
  const path = resolve(REPO_ROOT, "data/events", `${eventId}.json`);
  const ev = JSON.parse(readFileSync(path, "utf8")) as EventFile;
  const byTag = new Map<string, { overall: number; role: string }[]>();
  for (const c of ev.cards) {
    if (!byTag.has(c.teamTag)) byTag.set(c.teamTag, []);
    byTag.get(c.teamTag)!.push({ overall: c.overall, role: c.role });
  }
  const teams: SimTeam[] = [];
  for (const team of ev.teams) {
    const top = (byTag.get(team.tag) ?? []).sort((a, b) => b.overall - a.overall).slice(0, 5);
    if (top.length === 0) continue;
    teams.push({
      id: team.tag,
      name: team.name,
      tag: team.tag,
      strength: strengthOf(top.map((p) => p.overall)),
      attackMod: attackModFromComp(top, params.sideRoleWeight, params.sideQualityWeight),
    });
  }
  return teams.sort((a, b) => b.strength - a.strength);
}

const seriesScore = (m: MatchResult) => `${m.series.mapsA}-${m.series.mapsB}`;

function printMatch(m: MatchResult) {
  const a = m.teamA.name.padEnd(20);
  const b = m.teamB.name;
  const mapScores = m.series.maps.map((mp) => `${mp.scoreA}-${mp.scoreB}`).join(", ");
  console.log(`  [${m.id.padEnd(4)}] ${a} ${seriesScore(m)}  ${b.padEnd(20)} (${mapScores})`);
}

function printMapRounds(map: MapResult, teamA: string, teamB: string) {
  console.log(`\n  ── Round a round: ${map.name} — ${teamA} ${map.scoreA}-${map.scoreB} ${teamB} ──`);
  let line = "";
  for (const r of map.rounds) {
    const who = r.winner === "a" ? teamA : teamB;
    const tag = r.isPistol ? "P" : r.attacker === "a" ? ">" : "<";
    const cell = `R${String(r.number).padStart(2)}${tag} ${who.slice(0, 3).padEnd(3)} ${r.scoreA}-${r.scoreB}`;
    line += cell.padEnd(20);
    if (r.number % 4 === 0) {
      console.log("   " + line.trimEnd());
      line = "";
    }
  }
  if (line) console.log("   " + line.trimEnd());
  console.log("   (P=pistol, >=A atacando, <=B atacando)");
}

function main() {
  const [eventId = "1015", version = "v1", seedArg] = process.argv.slice(2);
  const params = version === "v2" ? DEFAULT_ROUND_CAMPAIGN : DEFAULT_ROUND_V1;
  const seed = seedArg ? seedFrom(seedArg) : seedFrom(`${eventId}:${version}`);

  const all = loadTeams(eventId, params);
  console.log(`\n═══ Simulação 11A3 — evento ${eventId} — modelo de round ${version} — seed ${seed} ═══`);
  console.log(`Força do time = média dos 5 maiores overalls. ${all.length} times disponíveis.\n`);

  const rng = createRng(seed);
  const matches: MatchResult[] = [];
  let standings: { team: SimTeam; placeLabel: string }[];
  let seeds: SimTeam[];

  if (all.length >= 16) {
    const cfg: TournamentConfig = { ...DEFAULT_TOURNAMENT, round: params };
    const r = simulateTournament(all.slice(0, 16), cfg, params, rng);
    seeds = r.seeds;
    standings = r.standings;
    matches.push(...r.matches);
    console.log("Fase de grupos → playoffs (double-elim 8) → grande final MD5.");
  } else if (all.length >= 8) {
    const cfg: TournamentConfig = { ...DEFAULT_TOURNAMENT, round: params };
    seeds = all.slice(0, 8);
    const r = simulateDoubleElim8(seeds, cfg, params, rng, matches);
    standings = r.standings;
    console.log("Poucos times para grupos: playoffs direto (double-elim 8) com os 8 mais fortes.");
  } else {
    console.error("Times insuficientes para simular (mínimo 8).");
    return;
  }

  console.log("\nSeeds (entrada do playoff):");
  seeds.forEach((t, i) => console.log(`  ${i + 1}. ${t.name.padEnd(22)} força ${t.strength.toFixed(1)}`));

  console.log("\nPlayoffs:");
  for (const m of matches.filter((m) => !m.id.startsWith("G"))) printMatch(m);

  // Round-by-round sample: first map of the grand final.
  const gf = matches.find((m) => m.id === "GF");
  if (gf && gf.series.maps[0]) {
    printMapRounds(gf.series.maps[0], gf.teamA.name, gf.teamB.name);
  }

  console.log("\nClassificação final:");
  for (const s of standings) console.log(`  ${s.placeLabel.padEnd(7)} ${s.team.name}`);
  console.log("");
}

main();
