/**
 * Drafting Service
 *
 * Handles proposal draft generation and revision management.
 */

import {
	createDefaultFunderSummary,
	createDefaultGrantChecklist,
} from "../../../../shared/seed-data";
import type {
	DocumentMetadata,
	DraftArtifact,
	Grant,
	Notification,
	OrganizationProfile,
	RevisionRequest,
} from "../../../../shared/types";
import { escapeForHtml } from "../../lib/sanitize-html";
import { getDependencies } from "./dependencies";

export interface GenerateDraftOptions {
	revisionNotes?: string;
	suppressNotification?: boolean;
	/**
	 * @internal Test-only option. Do not use in production code.
	 */
	_providerType?: "cli" | "fake";
}

function getGroundingDocuments(documents: DocumentMetadata[]): string[] {
	return documents
		.filter((document) => document.extractionStatus === "extracted")
		.slice(0, 5)
		.map((document) => {
			const parts = [`Document: ${document.name}`];

			if (document.contentSnippet) {
				parts.push(`Snippet: ${document.contentSnippet}`);
			} else if (document.extractedText) {
				parts.push(`Excerpt: ${document.extractedText.slice(0, 500)}`);
			}

			return parts.join("\n");
		});
}

export async function generateDraft(
	grant: Grant,
	profile: OrganizationProfile,
	options: GenerateDraftOptions = {},
): Promise<DraftArtifact> {
	const deps = getDependencies();
	const clock = deps.clock;
	const idGenerator = deps.idGenerator;

	const existingDrafts = await deps.repository.getDraftArtifacts(grant.id);
	const latestVersion =
		existingDrafts.length > 0
			? Math.max(...existingDrafts.map((d) => d.version))
			: 0;

	const settings = await deps.repository.getOpencodeSettings();
	const providerType = options._providerType || "cli";

	if (providerType === "cli" && !settings?.isConfigured) {
		throw new Error(
			"Opencode is not configured. Please set up Opencode settings in the application before generating drafts.",
		);
	}

	const adapter = deps.createOpencodeAdapter(
		settings ?? {
			binaryPath: "",
			workingDirectory: "",
			timeoutMs: 60000,
			isConfigured: false,
		},
		providerType,
	);
	const previousDraft = await deps.repository.getLatestDraftArtifact(grant.id);
	const previousContent = previousDraft?.content;
	const documents = await deps.repository.getDocuments();
	const groundedDocuments = getGroundingDocuments(documents);

	const response = await adapter.generateDraft({
		grantTitle: grant.title,
		grantFunder: grant.funder,
		grantAmount: grant.award,
		grantDeadline: grant.deadline,
		organizationProfile: `${profile.legalName}\n\nEIN: ${profile.ein}\nSAM UEI: ${profile.samUEI}`,
		missionStatement: profile.mission,
		previousDraft: previousContent || "",
		revisionNotes: options.revisionNotes || "",
		groundingDocuments: groundedDocuments,
	});

	if (!response.success || !response.content) {
		throw new Error(
			`Draft generation failed: ${response.error || "Unknown error from Opencode"}`,
		);
	}

	const draftArtifact: DraftArtifact = {
		id: idGenerator.generateId("draft"),
		grantId: grant.id,
		version: latestVersion + 1,
		content: response.content,
		createdAt: clock.now().toISOString(),
		createdBy: "agent",
		revisionNotes: options.revisionNotes || "",
	};

	await deps.repository.addDraftArtifact(draftArtifact);
	const nextSourceCount =
		groundedDocuments.length > 0
			? groundedDocuments.length
			: (grant.sourceCount ?? 0);
	await deps.repository.updateGrant(grant.id, {
		status: "draft",
		statusLabel: "Drafting",
		draftContent: response.content,
		latestDraftVersion: draftArtifact.version,
		groundedDocumentCount: groundedDocuments.length,
		sourceCount: nextSourceCount,
		funderSummary: grant.funderSummary ?? createDefaultFunderSummary(grant),
		checklist:
			grant.checklist ??
			createDefaultGrantChecklist({
				...grant,
				draftContent: response.content,
				latestDraftVersion: draftArtifact.version,
				groundedDocumentCount: groundedDocuments.length,
				sourceCount: nextSourceCount,
			}),
	});

	if (!options.suppressNotification) {
		const existingNotifications = await deps.repository.getNotifications();
		const safeTitle = escapeForHtml(grant.title);
		const draftNotification: Notification = {
			id: idGenerator.generateId("notification"),
			dot: "accent",
			time: clock.now().toISOString(),
			text: `Draft generated for <strong>${safeTitle}</strong> (v${draftArtifact.version}) · awaiting review`,
		};
		existingNotifications.unshift(draftNotification);
		await deps.repository.updateNotifications(existingNotifications);
	}

	return draftArtifact;
}

export async function createRevisionRequest(
	grant: Grant,
	notes: string,
	requestedBy: string,
): Promise<RevisionRequest> {
	const deps = getDependencies();
	const idGenerator = deps.idGenerator;

	const drafts = await deps.repository.getDraftArtifacts(grant.id);
	const latestVersion =
		drafts.length > 0 ? Math.max(...drafts.map((d) => d.version)) : 0;

	const revisionRequest: RevisionRequest = {
		id: idGenerator.generateId("revision"),
		grantId: grant.id,
		draftVersion: latestVersion,
		notes,
		requestedAt: new Date().toISOString(),
		requestedBy,
		status: "pending",
	};

	await deps.repository.addRevisionRequest(revisionRequest);
	await deps.repository.updateGrant(grant.id, {
		status: "draft",
		statusLabel: "Revision requested",
	});

	return revisionRequest;
}

export async function getDraftArtifacts(
	grantId: string,
): Promise<DraftArtifact[]> {
	const deps = getDependencies();
	return deps.repository.getDraftArtifacts(grantId);
}

export async function getRevisionRequests(
	grantId: string,
): Promise<RevisionRequest[]> {
	const deps = getDependencies();
	return deps.repository.getRevisionRequests(grantId);
}
