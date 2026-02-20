import { createJsonAdapter } from "@/lib/persistence/adapters/json-adapter";
import { createPostgresAdapter } from "@/lib/persistence/adapters/postgres-adapter";
import { createSqliteAdapter } from "@/lib/persistence/adapters/sqlite-adapter";

function getAdapterKey() {
  return (process.env.STORAGE_ADAPTER || "json").toLowerCase();
}

export function createPersistenceAdapter() {
  const key = getAdapterKey();

  if (key === "json") return createJsonAdapter();
  if (key === "sqlite") return createSqliteAdapter();
  if (key === "postgres") return createPostgresAdapter();

  throw new Error(
    `Unsupported STORAGE_ADAPTER="${key}". Supported values: json, sqlite, postgres.`,
  );
}
