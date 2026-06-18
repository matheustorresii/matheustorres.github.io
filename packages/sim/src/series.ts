import type { MapPool, RoundParams } from "./config.js";
import type { SeriesResult, SimTeam } from "./types.js";
import type { Rng } from "./rng.js";
import { simulateMap } from "./map.js";

/** Pick `count` distinct maps from the pool (v1: random; veto comes in a later phase). */
function pickMaps(pool: MapPool, count: number, rng: Rng): string[] {
  const bag = [...pool.maps];
  // Fisher–Yates using the injected rng.
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  if (bag.length >= count) return bag.slice(0, count);
  // Pool smaller than a full BoN: allow repeats to fill (degenerate config).
  const out = [...bag];
  while (out.length < count) out.push(bag[out.length % bag.length]!);
  return out;
}

export function simulateSeries(
  teamA: SimTeam,
  teamB: SimTeam,
  bestOf: number,
  pool: MapPool,
  params: RoundParams,
  rng: Rng,
): SeriesResult {
  const needed = Math.floor(bestOf / 2) + 1; // first to (bo/2)+1
  const maps = pickMaps(pool, bestOf, rng);
  const result: SeriesResult = {
    bestOf,
    winner: "a",
    mapsA: 0,
    mapsB: 0,
    maps: [],
    teamA,
    teamB,
  };

  for (const mapName of maps) {
    if (result.mapsA === needed || result.mapsB === needed) break;
    const m = simulateMap(teamA, teamB, mapName, params, rng);
    result.maps.push(m);
    if (m.winner === "a") result.mapsA++;
    else result.mapsB++;
  }

  result.winner = result.mapsA > result.mapsB ? "a" : "b";
  return result;
}
