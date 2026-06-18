import { useEffect, useMemo, useState } from "react";
import type {
  EventFile,
  EventIndexEntry,
  PlacementTier,
  Player,
  PlayerCard,
  PlayerEventStats,
  Role,
  Team,
} from "@11a3/domain";
import { ROLE_ABBR_PT, ROLE_LABEL_PT, TIER_LABEL_PT, overallClass } from "./labels.js";
import { asset } from "./asset.js";

interface PlayerIndexEntry {
  id: string;
  handle: string;
  displayName: string;
  appearances: {
    eventId: string;
    eventName: string;
    year: number;
    teamTag: string;
    role: Role;
    overall: number;
  }[];
}

// `path` is a public-dir path like "/data/index.json"; asset() rebases it under
// the app's base URL so the inspector works on a GitHub Pages subpath too.
const json = <T,>(path: string) => fetch(asset(path)).then((r) => r.json() as Promise<T>);

/** Format a stat, showing "—" when the value is missing (VLR didn't publish it). */
const fmt = (v: number, digits: number, suffix = "") =>
  v > 0 ? v.toFixed(digits) + suffix : "—";

export function Inspector() {
  const [index, setIndex] = useState<EventIndexEntry[]>([]);
  const [players, setPlayers] = useState<PlayerIndexEntry[]>([]);
  const [year, setYear] = useState<number | "all">("all");
  const [eventId, setEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    json<EventIndexEntry[]>("/data/index.json").then(setIndex).catch(() => setIndex([]));
    json<PlayerIndexEntry[]>("/data/players/index.json")
      .then(setPlayers)
      .catch(() => setPlayers([]));
  }, []);

  const years = useMemo(
    () => [...new Set(index.map((e) => e.year))].sort((a, b) => b - a),
    [index],
  );
  const visibleEvents = useMemo(
    () => index.filter((e) => year === "all" || e.year === year),
    [index, year],
  );

  // Default-select the first visible event.
  useEffect(() => {
    if (visibleEvents.length && !visibleEvents.some((e) => e.id === eventId)) {
      setEventId(visibleEvents[0]!.id);
    }
  }, [visibleEvents, eventId]);

  return (
    <>
      <div className="filters inspector-filters">
          <label>
            Ano
            <select
              value={String(year)}
              onChange={(e) =>
                setYear(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">Todos</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campeonato
            <select value={eventId ?? ""} onChange={(e) => setEventId(e.target.value)}>
              {visibleEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            Buscar jogador
            <input
              placeholder="ex.: aspas, pancada, derke…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

      {search.trim() ? (
        <PlayerSearch players={players} query={search.trim()} />
      ) : eventId ? (
        <EventView eventId={eventId} />
      ) : (
        <p className="empty">Nenhum evento ingerido. Rode <code>npm run ingest -- 1015</code>.</p>
      )}
    </>
  );
}

function PlayerSearch({ players, query }: { players: PlayerIndexEntry[]; query: string }) {
  const q = query.toLowerCase();
  const matches = players
    .filter((p) => p.handle.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q))
    .slice(0, 40);

  if (!matches.length) return <p className="empty">Nenhum jogador encontrado para “{query}”.</p>;

  return (
    <div className="search-results">
      {matches.map((p) => (
        <div className="search-card" key={p.id}>
          <div className="search-name">{p.displayName}</div>
          <table className="appearances">
            <tbody>
              {p.appearances.map((a, i) => (
                <tr key={i}>
                  <td className={overallClass(a.overall)}>{a.overall}</td>
                  <td className="role-cell">{ROLE_ABBR_PT[a.role]}</td>
                  <td>{a.teamTag}</td>
                  <td className="muted">{a.eventName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const TIER_ORDER: Record<PlacementTier, number> = {
  champion: 0,
  runnerUp: 1,
  top4: 2,
  top8: 3,
  top12: 4,
  groups: 5,
};

function EventView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventFile | null>(null);
  useEffect(() => {
    setData(null);
    json<EventFile>(`/data/events/${eventId}.json`).then(setData).catch(() => setData(null));
  }, [eventId]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const statsBy = new Map<string, PlayerEventStats>(data.stats.map((s) => [s.playerId, s]));
    const playerBy = new Map<string, Player>(data.players.map((p) => [p.id, p]));
    const placementBy = new Map(data.placements.map((p) => [p.teamTag, p]));
    const teamBy = new Map<string, Team>(data.teams.map((t) => [t.tag, t]));

    const byTeam = new Map<string, PlayerCard[]>();
    for (const c of data.cards) {
      if (!byTeam.has(c.teamTag)) byTeam.set(c.teamTag, []);
      byTeam.get(c.teamTag)!.push(c);
    }

    return [...byTeam.entries()]
      .map(([tag, cards]) => {
        const placement = placementBy.get(tag);
        return {
          team: teamBy.get(tag),
          tag,
          placement,
          cards: cards.sort((a, b) => b.overall - a.overall),
          statsBy,
          playerBy,
        };
      })
      .sort((a, b) => {
        const ta = a.placement?.tier ?? "groups";
        const tb = b.placement?.tier ?? "groups";
        return (
          TIER_ORDER[ta] - TIER_ORDER[tb] ||
          (a.placement?.rank ?? 99) - (b.placement?.rank ?? 99) ||
          (a.team?.name ?? a.tag).localeCompare(b.team?.name ?? b.tag)
        );
      });
  }, [data]);

  if (!data) return <p className="empty">Carregando…</p>;

  return (
    <div className="event">
      <div className="event-head">
        <h2>
          {data.event.name} <span className="muted">· {data.event.year}</span>
        </h2>
        <span className="muted small">
          {data.teams.length} times · {data.cards.length} jogadores
        </span>
      </div>

      {grouped.map((g) => (
        <section className="team" key={g.tag}>
          <div className="team-head">
            <span className={`tier tier-${g.placement?.tier ?? "groups"}`}>
              {TIER_LABEL_PT[g.placement?.tier ?? "groups"]}
            </span>
            <span className="team-name">{g.team?.name ?? g.tag}</span>
            <span className="team-tag muted">{g.tag}</span>
          </div>
          <div className="players">
            {g.cards.map((c) => {
              const s = g.statsBy.get(c.playerId);
              const p = g.playerBy.get(c.playerId);
              return (
                <div className="player" key={c.cardId}>
                  <span className={overallClass(c.overall)}>{c.overall}</span>
                  <span className="pname">{p?.displayName ?? c.playerId}</span>
                  <span className="role">
                    {ROLE_LABEL_PT[c.role]}
                    {c.isFlex && <span className="flex">FLEX</span>}
                  </span>
                  {s && (
                    <span className="stats">
                      <b>R2.0</b> {fmt(s.r20, 2)} <b>ACS</b> {fmt(s.acs, 0)}{" "}
                      <b>K:D</b> {fmt(s.kd, 2)} <b>KAST</b> {fmt(s.kast, 0, "%")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
