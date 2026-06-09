/**
 * Canonical app network config — the single source of truth for the port and
 * host. Everything (package.json scripts, Playwright configs, e2e tests, the
 * server runtime, and shell scripts) derives from `config/app.json`, so the
 * port is changed in exactly one place.
 *
 * Default port 3885. (Hacker Dojo's street address, 855 Maude Ave, is a
 * privileged port below 1024 and can't be bound without root, so the default
 * keeps the "885" nod while staying in the unprivileged range.)
 * Override at runtime with the PORT (and APP_HOST) environment variables.
 */
import appNetwork from '../config/app.json';

function resolvePort(): number {
  const fromEnv = Number.parseInt(process.env.PORT ?? '', 10);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : appNetwork.port;
}

export const APP_PORT = resolvePort();
export const APP_HOST = process.env.APP_HOST ?? appNetwork.host;
export const APP_BASE_URL = `http://${APP_HOST}:${APP_PORT}`;
