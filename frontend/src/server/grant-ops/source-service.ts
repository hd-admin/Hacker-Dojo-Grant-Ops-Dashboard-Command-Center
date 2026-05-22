/**
 * Source Service
 *
 * Manages grant source CRUD operations and source-related business logic.
 */

import { Source } from '../../../../shared/types';
import * as repository from './repository';

export interface AddSourceInput {
  name: string;
  url: string;
  type: 'website' | 'database' | 'api';
}

export interface SourceService {
  getAllSources(): Promise<Source[]>;
  addSource(input: AddSourceInput): Promise<Source>;
  removeSource(id: string): Promise<boolean>;
  activateSource(id: string): Promise<boolean>;
  deactivateSource(id: string): Promise<boolean>;
  getActiveSources(): Promise<Source[]>;
}

export async function getAllSources(): Promise<Source[]> {
  return repository.getSources();
}

export async function addSource(input: AddSourceInput): Promise<Source> {
  const source: Source = {
    id: `source-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
    name: input.name,
    url: input.url,
    type: input.type,
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  await repository.addSource(source);
  return source;
}

export async function removeSource(id: string): Promise<boolean> {
  await repository.removeSource(id);
  return true;
}

export async function activateSource(id: string): Promise<boolean> {
  const sources = await repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = true;
  await repository.removeSource(id);
  await repository.addSource(source);
  return true;
}

export async function deactivateSource(id: string): Promise<boolean> {
  const sources = await repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = false;
  await repository.removeSource(id);
  await repository.addSource(source);
  return true;
}

export async function getActiveSources(): Promise<Source[]> {
  const sources = await repository.getSources();
  return sources.filter((s) => s.isActive);
}

export async function updateSourceLastCrawled(id: string): Promise<boolean> {
  const sources = await repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.lastCrawledAt = new Date().toISOString();
  await repository.removeSource(id);
  await repository.addSource(source);
  return true;
}
