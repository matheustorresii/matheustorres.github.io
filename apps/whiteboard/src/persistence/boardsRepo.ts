import type { Board, BoardMeta } from "../types/model";
import { getDB } from "./db";

export async function putBoard(board: Board): Promise<void> {
  const db = await getDB();
  await db.put("boards", board);
}

export async function getBoard(id: string): Promise<Board | undefined> {
  const db = await getDB();
  return db.get("boards", id);
}

export async function deleteBoard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("boards", id);
}

export async function allBoards(): Promise<Board[]> {
  const db = await getDB();
  return db.getAll("boards");
}

export async function boardMetas(): Promise<BoardMeta[]> {
  const boards = await allBoards();
  return boards.map((b) => ({
    id: b.id,
    name: b.name,
    folderId: b.folderId,
    updatedAt: b.updatedAt,
    thumbnailDataUrl: b.thumbnailDataUrl,
  }));
}
