import { getDataDir, getDataPath } from '../shared/grant-ops-persistence';

const dataDir = getDataDir();
process.stdout.write(`${dataDir}\n`);
process.stdout.write(`${getDataPath()}\n`);
