declare module 'better-sqlite3' {
  // Minimal type declaration for better-sqlite3
  class Database {
    constructor(
      filename: string,
      options?: {
        readonly?: boolean;
        fileMustExist?: boolean;
        timeout?: number;
        verbose?: (message: string) => void;
      },
    );
    prepare(sql: string): Database.Statement;
    exec(sql: string): void;
    close(): void;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    checkpoint(databaseName?: string): void;
    function(
      name: string,
      options: { deterministic?: boolean; varargs?: boolean; directOnly?: boolean },
      fn: (...args: unknown[]) => unknown,
    ): void;
    aggregate(
      name: string,
      options: {
        start: () => unknown;
        step: (total: unknown, next: unknown) => unknown;
        result?: (total: unknown) => unknown;
        deterministic?: boolean;
        varargs?: boolean;
        directOnly?: boolean;
      },
    ): void;
    loadExtension(path: string, entryPoint?: string): void;
    defaultSafeIntegers(toggleState?: boolean): Database;
    unsafeMode(toggleState?: boolean): Database;
    transaction<T>(fn: () => T): () => T;
    transaction<T extends unknown[]>(fn: (...args: T) => unknown): (...args: T) => unknown;
    readonly open: boolean;
    readonly inTransaction: boolean;
    readonly name: string;
    readonly memory: boolean;
    readonly readonly: boolean;
  }

  namespace Database {
    class Statement {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      iterate(...params: unknown[]): IterableIterator<unknown>;
      pluck(toggleState?: boolean): Statement;
      expand(toggleState?: boolean): Statement;
      raw(toggleState?: boolean): Statement;
      bind(...params: unknown[]): Statement;
      columns(): Array<{
        name: string;
        column: string | null;
        table: string | null;
        database: string | null;
        type: string | null;
      }>;
      safeIntegers(toggleState?: boolean): Statement;
      readonly source: string;
      readonly database: Database;
    }
  }

  export = Database;
}
