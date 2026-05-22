import type { ElectronAPI } from '../../../shared/types';

export type { ElectronAPI };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
