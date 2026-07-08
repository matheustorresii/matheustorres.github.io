import { getDB } from "./db";

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = await db.get("settings", key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value });
}
