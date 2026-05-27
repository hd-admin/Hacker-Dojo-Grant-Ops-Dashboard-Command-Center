/**
 * Source Service
 *
 * Manages grant source CRUD operations and source-related business logic.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 */

import { Source } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export interface AddSourceInput {
  name: string;
  url: string;
  type: 'website' | 'database' | 'api';
  reviewStatus?: Source['reviewStatus'];
  suggestedBy?: string;
  suggestionReason?: string;
  category?: Source['category'];
  categoryRationale?: string;
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
  const deps = getDependencies();
  return deps.repository.getSources();
}

export async function addSource(input: AddSourceInput): Promise<Source> {
  const deps = getDependencies();
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  const source: Source = {
    id: idGenerator.generateId('source'),
    name: input.name,
    url: input.url,
    type: input.type,
    createdAt: clock.now().toISOString(),
    isActive: true,
    reviewStatus: input.reviewStatus ?? 'approved',
  };
  if (input.suggestedBy !== undefined) source.suggestedBy = input.suggestedBy;
  if (input.suggestionReason !== undefined) source.suggestionReason = input.suggestionReason;
  if (input.category !== undefined) source.category = input.category;
  if (input.categoryRationale !== undefined) source.categoryRationale = input.categoryRationale;

  await deps.repository.addSource(source);
  return source;
}

export async function removeSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  await deps.repository.removeSource(id);
  return true;
}

export async function activateSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = true;
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}

export async function deactivateSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = false;
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}

export async function getActiveSources(): Promise<Source[]> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  return sources.filter((s) => s.isActive && (s.reviewStatus === undefined || s.reviewStatus === 'approved'));
}

export async function updateSourceLastCrawled(id: string): Promise<boolean> {
  const deps = getDependencies();
  const clock = deps.clock;
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.lastCrawledAt = clock.now().toISOString();
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}
