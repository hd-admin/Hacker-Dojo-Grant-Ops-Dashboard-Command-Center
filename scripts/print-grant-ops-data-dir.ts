import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.grant-ops-data');
}

const dataDir = resolveDataDir();
process.stdout.write(`${dataDir}\n`);
process.stdout.write(`${path.join(dataDir, 'grant-ops.sqlite')}\n`);
