import 'server-only';
/**
 * Discovery Services
 *
 * Service functions for peer-discovery, funder-insights, and eligibility-vetting.
 * These queue agent jobs that produce typed artifacts.
 */

import { logger } from '@/lib/logger';
import {
  PeerDiscoveryArtifactSchema,
  FunderInsightArtifactSchema,
  EligibilityVettingArtifactSchema,
} from '../../../../shared/artifact-schemas';
import type {
  EligibilityVettingArtifact,
  FunderInsightArtifact,
  PeerDiscoveryArtifact,
} from '../../../../shared/artifact-schemas';
import { getDependencies } from './dependencies';

export interface PeerDiscoveryResult {
  artifact: PeerDiscoveryArtifact;
}

export interface FunderInsightsResult {
  artifact: FunderInsightArtifact;
}

export interface EligibilityVettingResult {
  artifact: EligibilityVettingArtifact;
}

/**
 * Run peer discovery analysis.
 * In production, this spawns an agent job. In tests, the adapter is mocked.
 */
export async function runPeerDiscovery(query?: string): Promise<PeerDiscoveryResult> {
  const deps = getDependencies();
  const now = deps.clock.now().toISOString();

  const profile = await deps.repository.getOrgProfile();
  const settings = await deps.repository.getOpencodeSettings();

  const adapter = deps.createOpencodeAdapter(
    settings ?? {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: false,
    },
    'cli',
  );

  const response = await adapter.executePeerDiscovery({
    query,
    organizationProfile: profile?.legalName || 'Hacker Dojo',
  });

  if (!response.success || !response.content) {
    throw new Error(`Peer discovery failed: ${response.error || 'Unknown error'}`);
  }

  const parsed = JSON.parse(response.content);
  const validated = PeerDiscoveryArtifactSchema.parse(parsed);

  const artifact: PeerDiscoveryArtifact = {
    ...validated,
    jobId: deps.idGenerator.generateId('peer'),
    timestamp: now,
  };

  logger.info('Peer discovery completed');
  return { artifact };
}

/**
 * Run funder insights analysis.
 * In production, this spawns an agent job. In tests, the adapter is mocked.
 */
export async function runFunderInsights(funderId: string): Promise<FunderInsightsResult> {
  const deps = getDependencies();
  const now = deps.clock.now().toISOString();

  const profile = await deps.repository.getOrgProfile();
  const settings = await deps.repository.getOpencodeSettings();

  const adapter = deps.createOpencodeAdapter(
    settings ?? {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: false,
    },
    'cli',
  );

  const response = await adapter.executeFunderInsights({
    funderId,
    organizationProfile: profile?.legalName || 'Hacker Dojo',
  });

  if (!response.success || !response.content) {
    throw new Error(`Funder insights failed: ${response.error || 'Unknown error'}`);
  }

  const parsed = JSON.parse(response.content);
  const validated = FunderInsightArtifactSchema.parse(parsed);

  const artifact: FunderInsightArtifact = {
    ...validated,
    jobId: deps.idGenerator.generateId('fi'),
    funderId,
    timestamp: now,
  };

  logger.info('Funder insights completed');
  return { artifact };
}

/**
 * Run eligibility vetting for a grant.
 * In production, this spawns an agent job. In tests, the adapter is mocked.
 */
export async function runEligibilityVetting(grantId: string): Promise<EligibilityVettingResult> {
  const deps = getDependencies();
  const now = deps.clock.now().toISOString();

  const profile = await deps.repository.getOrgProfile();
  const settings = await deps.repository.getOpencodeSettings();

  const adapter = deps.createOpencodeAdapter(
    settings ?? {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: false,
    },
    'cli',
  );

  const response = await adapter.executeEligibilityVetting({
    grantId,
    organizationProfile: profile?.legalName || 'Hacker Dojo',
  });

  if (!response.success || !response.content) {
    throw new Error(`Eligibility vetting failed: ${response.error || 'Unknown error'}`);
  }

  const parsed = JSON.parse(response.content);
  const validated = EligibilityVettingArtifactSchema.parse(parsed);

  const artifact: EligibilityVettingArtifact = {
    ...validated,
    jobId: deps.idGenerator.generateId('ev'),
    grantId,
    timestamp: now,
  };

  logger.info('Eligibility vetting completed');
  return { artifact };
}
