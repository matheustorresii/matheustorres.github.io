/** A team reduced to what the engine needs: an id, a name and a strength. */
export interface SimTeam {
  id: string;
  name: string;
  tag?: string;
  strength: number; // aggregate of the 5 overalls (see strengthOf)
  /**
   * Composition side bias: +N means the comp is N stronger on ATTACK rounds and
   * N weaker on DEFENSE rounds (and vice versa). Derived from the role mix
   * (duelist/initiator lean attack; controller/sentinel lean defense). Default 0.
   */
  attackMod?: number;
}

export type Side = "attack" | "defense";

/** One simulated round within a map. */
export interface RoundResult {
  number: number; // 1-based
  winner: "a" | "b";
  scoreA: number; // running score after this round
  scoreB: number;
  attacker: "a" | "b"; // which team was attacking this round
  isPistol: boolean;
  pWinA: number; // model probability A won this round (for transparency/UI)
}

export interface MapResult {
  name: string;
  winner: "a" | "b";
  scoreA: number;
  scoreB: number;
  rounds: RoundResult[];
}

export interface SeriesResult {
  bestOf: number;
  winner: "a" | "b";
  mapsA: number;
  mapsB: number;
  maps: MapResult[];
  teamA: SimTeam;
  teamB: SimTeam;
}
