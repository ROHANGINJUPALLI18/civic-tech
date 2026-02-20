function notImplemented() {
  throw new Error(
    "Postgres adapter is not wired yet. Set STORAGE_ADAPTER=json or implement Postgres persistence in lib/persistence/adapters/postgres-adapter.js",
  );
}

export function createPostgresAdapter() {
  return {
    async readStore() {
      notImplemented();
    },
    async writeStore() {
      notImplemented();
    },
  };
}
