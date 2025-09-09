declare module 'better-sqlite3' {
  // Minimal ambient module declaration to satisfy TypeScript without full @types.
  // For richer typings, install @types/better-sqlite3 in environments with network access.
  namespace Database {
    interface Statement {
      run: (...params: unknown[]) => unknown;
      get: (...params: unknown[]) => unknown;
      all: (...params: unknown[]) => unknown[];
    }
    interface Transaction {
      (...params: unknown[]): unknown;
    }
    interface Database {
      pragma: (pragma: string) => void;
      exec: (sql: string) => void;
      prepare: (sql: string) => Statement;
      transaction: (fn: (...args: unknown[]) => unknown) => Transaction;
    }
  }
  interface DatabaseConstructor {
    new (path?: string): Database.Database;
    (path?: string): Database.Database;
  }
  const BetterSqlite3: DatabaseConstructor;
  export = BetterSqlite3;
}
