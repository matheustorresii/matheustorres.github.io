import { useMemo } from "react";
import type { MatchResult, TournamentResult } from "@11a3/sim";
import { useT } from "../i18n.js";
import { USER_ID } from "./engine.js";

/**
 * Tournament tracker: groups (GSL) + playoff double-elim.
 *  - stageRank <= doneRank      → fully revealed (teams + score)
 *  - stageRank <= frontierRank  → matchup only (teams shown, result hidden)
 *  - otherwise                  → "a definir"
 */
export function Bracket({
  result,
  doneRank,
  frontierRank,
}: {
  result: TournamentResult;
  doneRank: number;
  frontierRank: number;
}) {
  const t = useT();
  const byId = useMemo(() => new Map(result.matches.map((m) => [m.id, m])), [result]);
  const get = (id: string) => byId.get(id);
  const full = (m: MatchResult | undefined) => !!m && m.stageRank <= doneRank;
  const matchup = (m: MatchResult | undefined) => !!m && m.stageRank <= frontierRank;

  return (
    <div className="bracket">
      <div className="br-section">
        <h4>{t("Grupos")}</h4>
        <div className="br-groups">
          {result.groups.map((_, g) => (
            <GroupCard key={g} g={g} result={result} full={full} />
          ))}
        </div>
      </div>

      <div className="br-section">
        <h4>{t("Chave superior")}</h4>
        <div className="br-cols">
          <Col title={t("Quartas")}>
            {["UQF1", "UQF2", "UQF3", "UQF4"].map((id) => (
              <Cell key={id} m={get(id)} full={full} matchup={matchup} />
            ))}
          </Col>
          <Col title={t("Semis")}>
            {["USF1", "USF2"].map((id) => (
              <Cell key={id} m={get(id)} full={full} matchup={matchup} />
            ))}
          </Col>
        </div>
      </div>

      <div className="br-section">
        <h4>{t("Chave inferior")}</h4>
        <div className="br-cols">
          <Col title="R1">
            {["LR1A", "LR1B"].map((id) => (
              <Cell key={id} m={get(id)} full={full} matchup={matchup} />
            ))}
          </Col>
          <Col title="R2">
            {["LR2A", "LR2B"].map((id) => (
              <Cell key={id} m={get(id)} full={full} matchup={matchup} />
            ))}
          </Col>
          <Col title={t("Semi")}>
            <Cell m={get("LR3")} full={full} matchup={matchup} />
          </Col>
        </div>
      </div>

      <div className="br-section">
        <h4>{t("Finais")}</h4>
        <div className="br-cols">
          <Col title={t("Final upper")}>
            <Cell m={get("UF")} full={full} matchup={matchup} />
          </Col>
          <Col title={t("Final lower")}>
            <Cell m={get("LF")} full={full} matchup={matchup} />
          </Col>
          <Col title={t("Grande final")}>
            <Cell m={get("GF")} full={full} matchup={matchup} grand />
          </Col>
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  g,
  result,
  full,
}: {
  g: number;
  result: TournamentResult;
  full: (m: MatchResult | undefined) => boolean;
}) {
  const t = useT();
  const revealedMatches = result.matches.filter((m) => m.group === g && full(m));
  const teams = result.groups[g]!.map((r) => r.team);
  const hasUser = teams.some((tm) => tm.id === USER_ID);

  const rows = teams
    .map((team) => {
      let w = 0, l = 0;
      for (const m of revealedMatches) {
        if (m.teamA.id === team.id || m.teamB.id === team.id) {
          if (m.winner.id === team.id) w++;
          else l++;
        }
      }
      const status = w >= 2 ? "ok" : l >= 2 ? "out" : "pending";
      return { team, w, l, status };
    })
    .sort((a, b) => b.w - a.w || a.l - b.l || a.team.name.localeCompare(b.team.name));

  return (
    <div className={`br-group ${hasUser ? "mine" : ""}`}>
      <div className="br-group-title">{t("Grupo")} {g + 1}{hasUser ? ` · ${t("seu grupo")}` : ""}</div>
      {rows.map((r) => (
        <div key={r.team.id} className={`br-grow ${r.team.id === USER_ID ? "me" : ""} st-${r.status}`}>
          <span className="br-gname">{r.team.name}</span>
          <span className="br-grec">{r.w}-{r.l}</span>
          <span className="br-gst">{r.status === "ok" ? "✓" : r.status === "out" ? "✗" : "·"}</span>
        </div>
      ))}
    </div>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="br-col">
      {title && <div className="br-col-title">{title}</div>}
      {children}
    </div>
  );
}

function Cell({
  m,
  full,
  matchup,
  grand,
}: {
  m: MatchResult | undefined;
  full: (m: MatchResult | undefined) => boolean;
  matchup: (m: MatchResult | undefined) => boolean;
  grand?: boolean;
}) {
  const t = useT();
  if (!m || !matchup(m)) return <div className="bm bm-tbd">{t("a definir")}</div>;
  const showResult = full(m);
  const aWin = m.winner.id === m.teamA.id;
  return (
    <div className={`bm ${grand ? "bm-grand" : ""} ${showResult ? "" : "bm-pending"}`}>
      <Row team={m.teamA.name} score={m.series.mapsA} win={showResult && aWin} me={m.teamA.id === USER_ID} show={showResult} />
      <Row team={m.teamB.name} score={m.series.mapsB} win={showResult && !aWin} me={m.teamB.id === USER_ID} show={showResult} />
    </div>
  );
}

function Row({
  team, score, win, me, show,
}: { team: string; score: number; win: boolean; me: boolean; show: boolean }) {
  return (
    <div className={`bm-team ${win ? "win" : ""} ${me ? "me" : ""}`}>
      <span className="bm-name">{team}</span>
      <span className="bm-sc">{show ? score : "–"}</span>
    </div>
  );
}
