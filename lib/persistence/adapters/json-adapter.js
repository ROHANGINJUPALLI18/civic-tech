import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { cloneDefaultStore } from "@/lib/persistence/default-store";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const STORE_TMP_PATH = path.join(DATA_DIR, "store.tmp.json");
const STORE_BAK_PATH = path.join(DATA_DIR, "store.bak.json");

let writeQueue = Promise.resolve();

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    const initialStore = cloneDefaultStore();
    const initial = JSON.stringify(initialStore, null, 2);
    await writeFile(STORE_PATH, initial, "utf8");
    await writeFile(STORE_BAK_PATH, initial, "utf8");
  }
}

export function createJsonAdapter() {
  return {
    async readStore() {
      await ensureStore();

      try {
        const raw = await readFile(STORE_PATH, "utf8");
        return JSON.parse(raw);
      } catch {
        try {
          const backup = await readFile(STORE_BAK_PATH, "utf8");
          const parsed = JSON.parse(backup);
          await writeFile(STORE_PATH, backup, "utf8");
          return parsed;
        } catch {
          const fallbackStore = cloneDefaultStore();
          const fallback = JSON.stringify(fallbackStore, null, 2);
          await writeFile(STORE_PATH, fallback, "utf8");
          await writeFile(STORE_BAK_PATH, fallback, "utf8");
          return fallbackStore;
        }
      }
    },

    async writeStore(nextStore) {
      await ensureStore();

      writeQueue = writeQueue.then(async () => {
        const payload = JSON.stringify(nextStore, null, 2);
        await writeFile(STORE_TMP_PATH, payload, "utf8");
        await rename(STORE_TMP_PATH, STORE_PATH);
        await writeFile(STORE_BAK_PATH, payload, "utf8");
      });

      return writeQueue;
    },
  };
}
