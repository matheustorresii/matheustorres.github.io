import * as cheerio from "cheerio";
import type { PlacementTier } from "@11a3/domain";

export interface RawPlacement {
  slug: string; // team slug from /team/{id}/{slug}
  vlrTeamId: string;
  name: string; // full name from the standings table
  rank: number; // lower bound, 1 = champion
  tier: PlacementTier;
  rawLabel: string; // e.g. "1st", "5th"
}

export function rankToTier(rank: number): PlacementTier {
  if (rank <= 1) return "champion";
  if (rank === 2) return "runnerUp";
  if (rank <= 4) return "top4";
  if (rank <= 8) return "top8";
  if (rank <= 12) return "top12";
  return "groups";
}

/**
 * Parse final placements from the event overview page's standings table
 * (`.wf-ptable--standings`). This table lists the playoff teams (typically top
 * 8) with id + name + place. Any team NOT listed is treated as "groups" by the
 * caller. Robust to varying formats because it only reads the standings grid,
 * not the bracket shape.
 */
export function parsePlacements(html: string): RawPlacement[] {
  const $ = cheerio.load(html);
  const table = $(".wf-ptable--standings").first();
  if (table.length === 0) return [];

  const out: RawPlacement[] = [];
  table.find(".row").each((i, row) => {
    if (i === 0) return; // header row (Place / Prize / Team)
    const $row = $(row);
    const cells = $row.find(".cell");
    const placeText = cells.first().text().trim(); // "1st", "5th", ...
    const rankMatch = placeText.match(/(\d+)/);
    if (!rankMatch) return;
    const rank = Number.parseInt(rankMatch[1]!, 10);

    const teamLink = $row.find('a[href^="/team/"]').first();
    const href = teamLink.attr("href") ?? "";
    const tm = href.match(/\/team\/(\d+)\/([a-z0-9._-]+)/i);
    if (!tm) return;

    const name = teamLink.find(".text-of").first().contents().first().text().trim();

    out.push({
      slug: tm[2]!,
      vlrTeamId: tm[1]!,
      name: name || tm[2]!,
      rank,
      tier: rankToTier(rank),
      rawLabel: placeText.replace(/\s+/g, ""),
    });
  });

  return out;
}

/** Map vlr /team/{id}/{slug} links anywhere on the overview to slug -> {id,name}. */
export function parseTeamLinks(html: string): Map<string, { vlrTeamId: string; name: string }> {
  const $ = cheerio.load(html);
  const map = new Map<string, { vlrTeamId: string; name: string }>();
  $('a[href*="/team/"]').each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const m = href.match(/\/team\/(\d+)\/([a-z0-9._-]+)/i);
    if (!m) return;
    const slug = m[2]!;
    if (map.has(slug)) return;
    const name =
      $(a).find(".text-of").first().contents().first().text().trim() ||
      $(a).find("span").first().text().trim();
    map.set(slug, { vlrTeamId: m[1]!, name });
  });
  return map;
}
