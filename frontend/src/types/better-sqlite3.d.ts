declare module 'better-sqlite3' {
  interface Statement<T = unknown> {
    run(...params: unknown[]): T;
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }

  interface Database {
    pragma(statement: string): void;
    exec(statement: string): void;
    prepare<T = unknown>(statement: string): Statement<T>;
    transaction<TArgs extends unknown[], R>(fn: (...args: TArgs) => R): (...args: TArgs) => R;
    close(): void;
  }

  export default class BetterSqlite3 implements Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    pragma(statement: string): void;
    exec(statement: string): void;
    prepare<T = unknown>(statement: string): Statement<T>;
    transaction<TArgs extends unknown[], R>(fn: (...args: TArgs) => R): (...args: TArgs) => R;
    close(): void;
  }
}
