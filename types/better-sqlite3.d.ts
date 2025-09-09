declare module 'better-sqlite3' {
  // Minimal ambient module declaration to satisfy TypeScript without full @types.
  // For richer typings, install @types/better-sqlite3 in environments with network access.
  namespace Database {
    interface Statement {
      run: (...params: any[]) => any;
      get: (...params: any[]) => any;
      all: (...params: any[]) => any[];
    }
    interface Transaction {
      (...params: any[]): any;
    }
    interface Database {
      pragma: (pragma: string) => void;
      exec: (sql: string) => void;
      prepare: (sql: string) => Statement;
      transaction: (fn: Function) => Transaction;
    }
  }
  interface DatabaseConstructor {
    new (path?: string): Database.Database;
    (path?: string): Database.Database;
  }
  const BetterSqlite3: DatabaseConstructor;
  export = BetterSqlite3;
}

