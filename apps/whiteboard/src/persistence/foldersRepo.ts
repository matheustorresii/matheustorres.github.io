import type { Folder } from "../types/model";
import { getDB } from "./db";

export async function putFolder(folder: Folder): Promise<void> {
  const db = await getDB();
  await db.put("folders", folder);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("folders", id);
}

export async function allFolders(): Promise<Folder[]> {
  const db = await getDB();
  return db.getAll("folders");
}
