declare module 'pino-roll' {
  import type { Writable } from 'node:stream';

  interface PinoRollOptions {
    file: string;
    size?: string | number;
    frequency?: string | number;
    extension?: string;
    limit?: number;
    symlink?: boolean;
    dateFormat?: string;
    mkdir?: boolean;
  }

  function pinoRoll(options: PinoRollOptions): Promise<Writable>;

  export = pinoRoll;
}
