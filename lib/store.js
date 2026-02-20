import { createPersistenceAdapter } from "@/lib/persistence/adapter-factory";

const adapter = createPersistenceAdapter();

export async function readStore() {
  return adapter.readStore();
}

export async function writeStore(nextStore) {
  return adapter.writeStore(nextStore);
}
