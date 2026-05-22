import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import path from 'path';
import log from 'electron-log';

let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3000;

export const startNextServer = (): Promise<string> => {
  return new Promise((resolve) => {
    if (app.isPackaged) {
      const serverPath = path.join(
        process.resourcesPath,
        'frontend',
        '.next',
        'standalone',
        'frontend',
        'server.js'
      );
      log.info(`[next-server] Starting packaged Next.js server from ${serverPath}`);
      serverProcess = spawn(process.execPath, [serverPath], {
        env: {
          ...process.env,
          PORT: String(SERVER_PORT),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
      });
    } else {
      const frontendDir = path.join(app.getAppPath(), 'frontend');
      log.info(`[next-server] Starting dev Next.js server in ${frontendDir}`);
      serverProcess = spawn('node', [path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(SERVER_PORT)], {
        cwd: frontendDir,
        env: { ...process.env, PORT: String(SERVER_PORT), HOSTNAME: '127.0.0.1' },
        stdio: 'pipe',
      });
    }

    serverProcess?.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.info(`[next-server] ${line}`);
    });

    serverProcess?.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.warn(`[next-server:error] ${line}`);
    });

    serverProcess?.on('error', (err) => {
      log.error('[next-server] Process error:', err);
    });

    const checkReady = (url: string) => {
      resolve(url);
    };

    // Poll until server is ready
    const interval = setInterval(() => {
      if (serverProcess?.killed) {
        clearInterval(interval);
        return;
      }
      try {
        const http = require('http');
        const req = http.get(`http://127.0.0.1:${SERVER_PORT}`, () => {
          clearInterval(interval);
          log.info(`[next-server] Server ready at http://127.0.0.1:${SERVER_PORT}`);
          checkReady(`http://127.0.0.1:${SERVER_PORT}`);
        });
        req.on('error', () => {
          // Not ready yet
        });
        req.setTimeout(100, () => req.destroy());
      } catch {
        // ignore
      }
    }, 500);

    // Timeout after 30s
    setTimeout(() => {
      clearInterval(interval);
      if (serverProcess && !serverProcess.killed) {
        log.warn('[next-server] Timeout waiting for server, using fallback URL');
        checkReady(`http://127.0.0.1:${SERVER_PORT}`);
      }
    }, 30000);
  });
};

export const stopNextServer = () => {
  if (serverProcess) {
    log.info('[next-server] Stopping server');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
};
