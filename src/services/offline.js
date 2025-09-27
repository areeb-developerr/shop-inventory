// Simple offline-first layer using Dexie for caching and queueing mutations
import Dexie from "dexie";

export const db = new Dexie("shop_inventory_db");
db.version(1).stores({
  products: "_id, name, category, updatedAt",
  customers: "_id, name, email, phone, updatedAt",
  bills: "_id, date, customerName, updatedAt",
  queue: "++id, type, path, method, body, createdAt",
  meta: "key",
});

export function isOnline() {
  return navigator.onLine;
}

export async function cacheList(key, items) {
  const table = db[key];
  if (!table) return;
  await table.clear();
  if (Array.isArray(items)) await table.bulkPut(items);
}

export async function getCachedList(key) {
  const table = db[key];
  if (!table) return [];
  return table.toArray();
}

export async function enqueueRequest({ type, path, method = "POST", body }) {
  return db.queue.add({
    type,
    path,
    method,
    body,
    createdAt: Date.now(),
  });
}

export async function flushQueue(requestFn) {
  if (!isOnline()) return { flushed: 0 };
  const items = await db.queue.orderBy("createdAt").toArray();
  let flushed = 0;
  for (const q of items) {
    try {
      await requestFn(q.path, {
        method: q.method,
        body: q.body ? JSON.stringify(q.body) : undefined,
        headers: { "Content-Type": "application/json" },
      });
      await db.queue.delete(q.id);
      flushed++;
    } catch (e) {
      // Stop on first failure to maintain order
      break;
    }
  }
  return { flushed };
}



