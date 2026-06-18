import * as cheerio from "cheerio";
import { normalizeAgent } from "@11a3/domain";

/** One parsed stats row, before normalization into domain objects. */
export interface RawStatRow {
  playerId: string;
  handle: string; // clean, from slug
  displayName: string; // pretty casing, from .text-of
  teamTag: string; // from .stats-player-country
  agents: string[]; // normalized agent keys, usage order
  rounds: number;
  r20: number;
  acs: number;
  kd: number;
  kast: number;
  adr: number;
  kpr: number;
  apr: number;
  fkpr: number;
  fdpr: number;
  hsPct: number;
  clPct: number;
  k: number;
  d: number;
  a: number;
  fk: number;
  fd: number;
  kmaxHref: string | undefined; // link to the player's KMax match (team resolution)
}

/** Parse "77%" / "260.0" / "" -> number (empty -> 0). */
function num(text: string): number {
  const cleaned = text.replace(/[%,]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const v = Number.parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}

export function parseStats(html: string): RawStatRow[] {
  const $ = cheerio.load(html);
  const rows: RawStatRow[] = [];

  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const link = $tr.find("td.mod-player a").first();
    const href = link.attr("href") ?? "";
    const m = href.match(/\/player\/(\d+)\/([a-z0-9._-]+)/i);
    if (!m) return; // not a player row

    const playerId = m[1]!;
    const handle = m[2]!;
    const displayName = $tr.find("td.mod-player .text-of").first().text().trim();
    const teamTag = $tr.find(".stats-player-country").first().text().trim();

    const agents: string[] = [];
    $tr.find("td.mod-agents img").each((_, img) => {
      const src = $(img).attr("src") ?? "";
      const base = src.split("/").pop() ?? "";
      const key = normalizeAgent(base);
      if (key) agents.push(key);
    });

    // Fixed column order (see VLR stats table header). Index into all <td>s.
    const tds = $tr.find("td").toArray().map((td) => $(td).text().trim());
    const at = (i: number) => num(tds[i] ?? "");

    const kmaxHref = $tr.find("td.mod-kmax a").attr("href") ?? undefined;

    rows.push({
      playerId,
      handle,
      displayName: displayName || handle,
      teamTag,
      agents,
      rounds: at(2),
      r20: at(3),
      acs: at(4),
      kd: at(5),
      kast: at(6),
      adr: at(7),
      kpr: at(8),
      apr: at(9),
      fkpr: at(10),
      fdpr: at(11),
      hsPct: at(12),
      clPct: at(13),
      // index 14 = CL won/played ("2/18"), index 15 = KMax — skipped
      k: at(16),
      d: at(17),
      a: at(18),
      fk: at(19),
      fd: at(20),
      kmaxHref,
    });
  });

  return rows;
}
