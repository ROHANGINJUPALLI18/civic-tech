function notImplemented() {
  throw new Error(
    "SQLite adapter is not wired yet. Set STORAGE_ADAPTER=json or implement SQLite persistence in lib/persistence/adapters/sqlite-adapter.js",
  );
}

export function createSqliteAdapter() {
  return {
    async readStore() {
      notImplemented();
    },
    async writeStore() {
      notImplemented();
    },
  };
}
