/**
 * Research Service
 *
 * Handles on-demand grant research using Opencode and stored sources.
 * Crawls sources, normalizes findings, ranks by fit/deadline/award, and persists evidence.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 * Production behavior: requires configured Opencode settings.
 */

import { ResearchResponseSchema } from "../../../../shared/schemas";
import type {
	CrawlRun,
	Grant,
	Notification,
	OpencodeSettings,
	OrganizationProfile,
	ResearchEvidence,
	Source,
} from "../../../../shared/types";
import { escapeForHtml } from "../../lib/sanitize-html";
import { type Clock, getDependencies, type IdGenerator } from "./dependencies";
import { scoreGrantByThemes } from "./theme-service";

/**
 * Create a default fit score breakdown when none is provided.
 * Returns null to indicate no breakdown is available - scoring should be done properly.
 */
function createDefaultFitBreakdown(_fit: number): null {
	return null;
}

/**
 * Create a default funder summary when none is provided.
 * Returns empty string - no fake funder summary should be generated.
 */
function createDefaultFunderSummary(_grant: Pick<Grant, 'funder' | 'title' | 'tags'>): string {
	return '';
}

/**
 * Create a default grant checklist when none is provided.
 * Returns empty array - real checklist items should be generated from grant requirements.
 */
function createDefaultGrantChecklist(_grant: Pick<Grant, 'fit' | 'status' | 'draftContent' | 'funderSummary' | 'latestDraftVersion' | 'groundedDocumentCount' | 'sourceCount'>): Array<{ label: string; done: boolean; source: string }> {
	return [];
}

export interface ResearchOptions {
	/**
	 * @internal Test-only option. Do not use in production code.
	 */
	_providerType?: "cli" | "fake";
	sourceIds?: string[];
}

export interface ResearchResult {
	crawlRun: CrawlRun;
	grantsFound: number;
	grantsMatched: number;
	error?: string;
}

export async function runResearch(
	profile: OrganizationProfile,
	options: ResearchOptions = {},
): Promise<ResearchResult> {
	const deps = getDependencies();
	const clock = deps.clock;
	const idGenerator = deps.idGenerator;

	const startTime = clock.now().toISOString();
	const crawlRunId = idGenerator.generateId("crawl");

	// Create initial crawl run record
	const crawlRun: CrawlRun = {
		id: crawlRunId,
		startedAt: startTime,
		status: "running",
		sourcesCrawled: 0,
		grantsFound: 0,
		grantsMatched: 0,
	};

	await deps.repository.addCrawlRun(crawlRun);

	try {
		// Get active sources
		let sources = await deps.sourceService.getActiveSources();
		if (options.sourceIds?.length) {
			const sourceIdSet = new Set(options.sourceIds);
			sources = sources.filter((source) => sourceIdSet.has(source.id));
			if (sources.length === 0) {
				throw new Error(`No active sources matched the requested source scope: ${options.sourceIds.join(', ')}`);
			}
		}

		// If no sources, create a default one based on search themes
		if (sources.length === 0) {
			const defaultSource = await deps.sourceService.addSource({
				name: "Default Search",
				url: "https://www.candid.org",
				type: "website",
			});
			sources.push(defaultSource);
		}

		const settings = await deps.repository.getOpencodeSettings();
		const providerType = options._providerType || "cli";

		// Only require settings for CLI provider (fake provider doesn't need them)
		if (providerType === "cli" && !settings?.isConfigured) {
			throw new Error(
				"Opencode is not configured. Please set up Opencode settings in the application before running research.",
			);
		}

		// Create Opencode adapter using DI
		const defaultSettings: OpencodeSettings = {
			binaryPath: "",
			workingDirectory: "",
			timeoutMs: 60000,
			isConfigured: false,
		};
		const adapter = deps.createOpencodeAdapter(
			settings || defaultSettings,
			providerType,
		);

		const result = await performResearch(
			profile,
			sources,
			adapter,
			deps,
			clock,
			idGenerator,
			crawlRun,
		);
		return result;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Update crawl run with error and persist
		crawlRun.completedAt = clock.now().toISOString();
		crawlRun.status = "failed";
		crawlRun.errorMessage = errorMessage;
		await deps.repository.updateCrawlRun(crawlRun);

		return {
			crawlRun,
			grantsFound: 0,
			grantsMatched: 0,
			error: errorMessage,
		};
	}
}

async function performResearch(
	profile: OrganizationProfile,
	sources: Source[],
	adapter: ReturnType<
		ReturnType<typeof getDependencies>["createOpencodeAdapter"]
	>,
	deps: ReturnType<typeof getDependencies>,
	clock: Clock,
	idGenerator: IdGenerator,
	initialCrawlRun: CrawlRun,
): Promise<ResearchResult> {
	let totalGrantsFound = 0;
	let totalGrantsMatched = 0;
	const existingGrants = await deps.repository.getGrants();
	const perGrantNotifications: Notification[] = [];

	// Process each source
	for (const source of sources) {
		try {
			// Use Opencode to research grants
			const response = await adapter.executeResearch({
				organizationProfile: `${profile.legalName}\n\nMission: ${profile.mission}`,
				searchThemes: profile.searchThemes,
				sourceName: source.name,
				sourceUrl: source.url,
			});

			await deps.sourceService.updateSourceLastCrawled(source.id);

			if (!response.success) {
				console.warn(
					`Research failed for source ${source.name}:`,
					response.error,
				);
			}

			if (response.success) {
				if (response.content) {
					// Parse the response (expecting JSON)
					let researchData: {
						grants: Array<{
							id?: string;
							title: string;
							funder: string;
							funderShort?: string;
							award?: string;
							awardSort?: number;
							deadline?: string;
							daysOut?: number;
							fit?: number;
							tags?: string[];
						}>;
						evidence?: ResearchEvidence[];
						rationale?: string;
					};
					try {
						const parsed = parseResearchResponseContent(response.content);
						const validated = ResearchResponseSchema.safeParse(parsed);
						if (!validated.success) {
							throw new Error(
								`Failed to parse research response from Opencode for source ${source.name}. Expected validated JSON with grants, evidence, and rationale.`,
							);
						}
						researchData = validated.data as typeof researchData;
					} catch (error) {
						if (error instanceof Error) {
							throw error;
						}
						throw new Error(
							`Failed to parse research response from Opencode for source ${source.name}. Expected JSON format.`,
						);
					}

					const grants = researchData.grants || [];
					const evidence = researchData.evidence || [];
					totalGrantsFound += grants.length;

					// Add new grants
					for (const grantData of grants) {
						const title = grantData.title;
						const funder = grantData.funder;
						if (!title || !funder) {
							continue;
						}

						const grantEvidence = evidence.filter(
							(item) => item.grantId === grantData.id,
						);
						const researchRationale = researchData.rationale;

						// Check if grant already exists
						const existing = existingGrants.find(
							(g) => g.title === title && g.funder === funder,
						);

						if (!existing) {
							const fallbackDeadline = new Date(
								clock.now().getTime() + 30 * 24 * 60 * 60 * 1000,
							)
								.toISOString()
								.slice(0, 10);
							const deadline = grantData.deadline ?? fallbackDeadline;
							const newGrant: Grant = {
								id: grantData.id || idGenerator.generateId("grant"),
								title,
								funder,
								funderShort: grantData.funderShort || funder.substring(0, 10),
								award:
									grantData.award ||
									`$${grantData.awardSort?.toLocaleString() || "0"}`,
								awardSort: grantData.awardSort || 0,
								deadline,
								daysOut:
									grantData.daysOut ?? calculateDaysOut(deadline, clock.now()),
								fit: grantData.fit ?? await scoreGrantByThemes(
								grantData.tags ?? profile.searchThemes.slice(0, 2)
							),
								tags: grantData.tags || profile.searchThemes.slice(0, 2),
								status: "matched",
								statusLabel: "Matched",
								matchedAt: clock.now().toISOString(),
								fitBreakdown: createDefaultFitBreakdown(grantData.fit || 70),
								funderSummary: createDefaultFunderSummary({
									title,
									funder,
									tags: grantData.tags || profile.searchThemes.slice(0, 2),
								}),
								checklist: createDefaultGrantChecklist({
									fit: grantData.fit || 70,
									status: "matched",
									latestDraftVersion: 0,
									groundedDocumentCount: 0,
									sourceCount: 1,
								}),
								latestDraftVersion: 0,
								groundedDocumentCount: 0,
								sourceCount: 1,
								researchEvidence: grantEvidence,
								...(researchRationale ? { researchRationale } : {}),
							};

							await deps.repository.addGrant(newGrant);
							existingGrants.push(newGrant);
							totalGrantsMatched++;

							perGrantNotifications.push({
								id: idGenerator.generateId("notification"),
								dot: "accent",
								time: clock.now().toISOString(),
								text: `New match: <strong>${escapeForHtml(newGrant.title)}</strong> · ${escapeForHtml(newGrant.funder)} · ${escapeForHtml(newGrant.award)} · fit ${newGrant.fit}`,
							});
						} else {
							const updatedSourceCount = (existing.sourceCount ?? 0) + 1;
							const mergedEvidence = mergeResearchEvidence(
								existing.researchEvidence,
								grantEvidence,
							);
							const updatedGrant: Partial<Grant> = {
								sourceCount: updatedSourceCount,
								fitBreakdown:
									existing.fitBreakdown ??
									createDefaultFitBreakdown(existing.fit),
								funderSummary:
									existing.funderSummary ??
									createDefaultFunderSummary(existing),
								checklist:
									existing.checklist ??
									createDefaultGrantChecklist({
										...existing,
										sourceCount: updatedSourceCount,
									}),
								researchEvidence: mergedEvidence,
								...((existing.researchRationale ?? researchRationale)
									? {
											researchRationale:
												existing.researchRationale ?? researchRationale,
										}
									: {}),
							};
							await deps.repository.updateGrant(existing.id, updatedGrant);
							Object.assign(existing, updatedGrant);
						}
					}
				}
			}
		} catch (error) {
			console.error(`Error crawling source ${source.name}:`, error);
			// No fallback grant creation: failed crawls should not invent matches.
		}
	}

	if (totalGrantsMatched === 0) {
		// Leave the existing grant store unchanged when a research run returns no new grants.
	}

	// Update crawl run with results and persist the initial crawlRun record directly
	initialCrawlRun.completedAt = clock.now().toISOString();
	initialCrawlRun.status = "completed";
	initialCrawlRun.sourcesCrawled = sources.length;
	initialCrawlRun.grantsFound = totalGrantsFound;
	initialCrawlRun.grantsMatched = totalGrantsMatched;
	await deps.repository.updateCrawlRun(initialCrawlRun);

	const notifications = await deps.repository.getNotifications();
	const summaryNotification: Notification = {
		id: idGenerator.generateId("notification"),
		dot: "success",
		time: clock.now().toISOString(),
		text: `Research completed: ${totalGrantsMatched} new grant(s) matched across ${sources.length} source(s)`,
	};
	const updatedNotifications = [
		...perGrantNotifications,
		summaryNotification,
		...notifications,
	];
	await deps.repository.updateNotifications(updatedNotifications);

	return {
		crawlRun: initialCrawlRun,
		grantsFound: totalGrantsFound,
		grantsMatched: totalGrantsMatched,
	};
}

function calculateDaysOut(deadline: string, now: Date = new Date()): number {
	if (!deadline) return 0;
	const deadlineDate = new Date(deadline);
	const diffTime = deadlineDate.getTime() - now.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
}

function parseResearchResponseContent(content: string): unknown {
	const trimmed = content.trim();
	const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fencedMatch?.[1]) {
		return JSON.parse(fencedMatch[1].trim()) as unknown;
	}

	return JSON.parse(trimmed) as unknown;
}

function mergeResearchEvidence(
	existingEvidence: ResearchEvidence[] | undefined,
	incomingEvidence: ResearchEvidence[],
): ResearchEvidence[] {
	const merged = new Map<string, ResearchEvidence>();

	for (const evidence of existingEvidence ?? []) {
		merged.set(evidence.id, evidence);
	}

	for (const evidence of incomingEvidence) {
		merged.set(evidence.id, evidence);
	}

	return [...merged.values()];
}

export async function getLatestCrawlRun(): Promise<CrawlRun | null> {
	const deps = getDependencies();
	return deps.repository.getLatestCrawlRun();
}

export async function getCrawlRuns(): Promise<CrawlRun[]> {
	const deps = getDependencies();
	return deps.repository.getCrawlRuns();
}
