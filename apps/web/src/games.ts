/**
 * Game registry. The app is multi-title: Valorant (the original 11A3) and a
 * Counter-Strike edition sharing the same simulation engine. Each game declares
 * its identity, where its draft pool lives, and whether its data is ready yet.
 *
 * Switching game flips a `data-game` attribute on <html>, which drives the
 * accent palette in styles.css (Valorant = red, CS = green + orange).
 */
import { asset } from "./asset.js";

export type GameId = "valorant" | "cs";

export interface GameDef {
  id: GameId;
  name: string; // tab label / heading (proper noun, not translated)
  mark: string; // short logo mark for the placeholder
  dataUrl: string; // draft pool JSON
  hasRoles: boolean; // Valorant has agent roles; CS drafts are roleless
  ready: boolean; // false → show the "under construction" placeholder
}

export const GAMES: GameDef[] = [
  {
    id: "valorant",
    name: "Valorant",
    mark: "11A3",
    dataUrl: asset("data/draft_pool.json"),
    hasRoles: true,
    ready: true,
  },
  {
    id: "cs",
    name: "Counter-Strike",
    mark: "CS",
    dataUrl: asset("data/cs/draft_pool.json"),
    hasRoles: false,
    ready: false,
  },
];

export const gameById = (id: GameId): GameDef => GAMES.find((g) => g.id === id) ?? GAMES[0]!;

export const isGameId = (v: unknown): boolean => v === "valorant" || v === "cs";
