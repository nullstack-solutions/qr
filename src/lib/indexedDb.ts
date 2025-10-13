import { openDB } from "idb";

const DB_NAME = "qr-suite";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    }
  });
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  const db = await getDb();
  return (await db.get(STORE_NAME, key)) ?? null;
}

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, value, key);
}

export async function clearDraft(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, key);
}
