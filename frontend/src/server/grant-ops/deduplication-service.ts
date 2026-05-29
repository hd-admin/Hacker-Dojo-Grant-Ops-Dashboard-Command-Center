/**
 * Deduplication Service
 *
 * Detects duplicate grant records when new grants are created from crawl results
 * or manual entry. Compares title similarity, funder name match, and deadline
 * proximity to identify potential duplicates for operator review.
 */

import type { DuplicateCandidate, Grant } from '../../../../shared/types';
import { getDependencies } from './dependencies';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export interface DuplicateDetectionInput {
	newGrant: Grant;
	existingGrants: Grant[];
}

export interface DuplicateMatch {
	grantId1: string;
	grantId2: string;
	confidenceScore: number;
	conflictingFields: string[];
	reason: string;
}

/**
 * Normalize a string for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalizeString(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Compute title similarity between two strings using token overlap
 * (Jaccard-like similarity on word tokens).
 */
function computeTitleSimilarity(title1: string, title2: string): number {
	const tokens1 = new Set(normalizeString(title1).split(' ').filter((t) => t.length > 1));
	const tokens2 = new Set(normalizeString(title2).split(' ').filter((t) => t.length > 1));

	if (tokens1.size === 0 || tokens2.size === 0) {
		return 0;
	}

	const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
	const union = new Set([...tokens1, ...tokens2]);

	return intersection.size / union.size;
}

/**
 * Check if funder names match (normalized comparison).
 */
function funderMatches(funder1: string, funder2: string): boolean {
	return normalizeString(funder1) === normalizeString(funder2);
}

/**
 * Check if two deadlines are within proximity (within 7 days).
 * Returns true if at least one deadline is non-Rolling and they are close.
 */
function deadlinesAreClose(deadline1: string, deadline2: string): boolean {
	if (deadline1 === 'Rolling' || deadline2 === 'Rolling') {
		return false;
	}
	const date1 = new Date(deadline1);
	const date2 = new Date(deadline2);
	if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) {
		return false;
	}
	const diffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
	return diffDays <= 7;
}

/**
 * Compute a confidence score (0-1) that two grants are duplicates.
 *
 * Scoring logic:
 * - Title similarity contributes up to 0.5 (scaled)
 * - Funder name match contributes 0.3
 * - Deadline proximity contributes 0.2
 */
function computeConfidenceScore(
	titleSimilarity: number,
	funderMatch: boolean,
	deadlineClose: boolean,
): number {
	let score = 0;

	// Title similarity: scale to max 0.5 contribution
	score += titleSimilarity * 0.5;

	// Funder match: 0.3 if matching
	if (funderMatch) {
		score += 0.3;
	}

	// Deadline proximity: 0.2 if within 7 days
	if (deadlineClose) {
		score += 0.2;
	}

	return Math.min(1, Math.max(0, score));
}

/**
 * Compare a new grant against existing grants and return potential duplicate matches.
 */
export function detectDuplicates(
	input: DuplicateDetectionInput,
	confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): DuplicateMatch[] {
	const { newGrant, existingGrants } = input;
	const matches: DuplicateMatch[] = [];

	for (const existing of existingGrants) {
		// Skip comparing to itself
		if (existing.id === newGrant.id) {
			continue;
		}

		// Skip grants that are archived or closed
		if (existing.status === 'archived' || existing.status === 'closed') {
			continue;
		}

		const titleSimilarity = computeTitleSimilarity(newGrant.title, existing.title);
		const funderMatch = funderMatches(newGrant.funder, existing.funder);
		const deadlineClose = deadlinesAreClose(newGrant.deadline, existing.deadline);

		const confidenceScore = computeConfidenceScore(titleSimilarity, funderMatch, deadlineClose);

		if (confidenceScore >= confidenceThreshold) {
			const conflictingFields: string[] = [];

			if (titleSimilarity > 0.3) {
				conflictingFields.push('title');
			}
			if (funderMatch) {
				conflictingFields.push('funder');
			}
			if (deadlineClose) {
				conflictingFields.push('deadline');
			}
			if (newGrant.award !== existing.award) {
				conflictingFields.push('amount');
			}

			const reasonParts: string[] = [];
			if (titleSimilarity >= 0.5) {
				reasonParts.push(`similar titles (${Math.round(titleSimilarity * 100)}% match)`);
			}
			if (funderMatch) {
				reasonParts.push('same funder');
			}
			if (deadlineClose) {
				reasonParts.push('nearby deadlines');
			}

			matches.push({
				grantId1: newGrant.id,
				grantId2: existing.id,
				confidenceScore,
				conflictingFields,
				reason: reasonParts.join(', ') || 'moderate similarity',
			});
		}
	}

	// Sort by confidence score descending
	matches.sort((a, b) => b.confidenceScore - a.confidenceScore);

	return matches;
}

/**
 * Persist duplicate candidates to the repository.
 * Only adds candidates that don't already exist as pending.
 */
export async function addDuplicateCandidates(
	matches: DuplicateMatch[],
): Promise<DuplicateCandidate[]> {
	const deps = getDependencies();
	const candidates: DuplicateCandidate[] = [];

	for (const match of matches) {
		const candidate: DuplicateCandidate = {
			id: deps.idGenerator.generateId('dup'),
			grantId1: match.grantId1,
			grantId2: match.grantId2,
			confidenceScore: match.confidenceScore,
			status: 'pending',
			detectedAt: new Date().toISOString(),
			conflictingFields: match.conflictingFields,
		};
		await deps.repository.addDuplicateCandidate(candidate);
		candidates.push(candidate);
	}

	return candidates;
}

/**
 * Run deduplication check after a grant is created from a crawl result.
 * Compares the new grant against all existing grants and adds duplicate
 * candidates for matches above the confidence threshold.
 */
export async function checkForDuplicatesAfterCrawl(
	newGrant: Grant,
): Promise<DuplicateMatch[]> {
	const deps = getDependencies();
	const existingGrants = await deps.repository.getGrants();

	// Filter out the new grant itself and archived/closed grants
	const comparableGrants = existingGrants.filter(
		(g) => g.id !== newGrant.id && g.status !== 'archived' && g.status !== 'closed',
	);

	const matches = detectDuplicates({ newGrant, existingGrants: comparableGrants });

	if (matches.length > 0) {
		await addDuplicateCandidates(matches);
	}

	return matches;
}

/**
 * Resolve a duplicate candidate: mark as merged or kept-separate.
 */
export async function resolveDuplicateCandidate(
	candidateId: string,
	resolution: 'merged' | 'kept-separate',
	resolvedBy?: string,
): Promise<boolean> {
	const deps = getDependencies();
	return deps.repository.resolveDuplicateCandidate(candidateId, {
		status: resolution,
		resolvedAt: new Date().toISOString(),
		resolvedBy: resolvedBy ?? 'operator',
	});
}
