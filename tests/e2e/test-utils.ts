import type { APIRequestContext, Page } from "@playwright/test";

export const BASE_URL = "http://127.0.0.1:3000";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetAppState(request: APIRequestContext): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		try {
			const response = await request.post(`${BASE_URL}/api/testing/reset`);
			if (response.ok()) {
				return;
			}
			throw new Error(`Failed to reset app state: ${response.status()}`);
		} catch (error) {
			lastError = error;
			await sleep(500);
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Failed to reset app state");
}


export async function openSettingsView(page: Page): Promise<void> {
	await page.click("[data-view=\"settings\"]");
	await page.waitForSelector("#view-settings.active", { timeout: 10000 });
}

// DEPRECATED: Profile is now hardcoded (v2). PUT /api/profile removed.
// Use this only as a no-op stub for backward compat with existing tests.
export async function saveProfileThroughSettingsView(
	_page: Page,
	_mission: string,
): Promise<void> {
	// Profile is hardcoded — no-op
}

// DEPRECATED: /api/opencode-settings removed in v2.
// Use opencode-stub.sh in PATH instead (via playwright-start.sh).
export async function configureOpencodeThroughSettingsView(
	_page: Page,
	_binaryPath: string,
	_workingDirectory: string,
): Promise<void> {
	// OpenCode is auto-detected or uses stub — no-op
}

export async function markScheduleDue(request: APIRequestContext, sourceId: string): Promise<void> {
	const response = await request.post(`${BASE_URL}/api/sources/${encodeURIComponent(sourceId)}/schedule/mark-due`);
	if (!response.ok()) {
		throw new Error(`Failed to mark schedule due for source ${sourceId}: ${response.status()}`);
	}
}

export async function uploadDocumentThroughSettingsView(
	page: Page,
	filePath: string,
): Promise<void> {
	await openSettingsView(page);
	const uploadResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/documents") &&
			response.request().method() === "POST",
	);
	const fileChooserPromise = page.waitForEvent("filechooser");
	await page.locator("button.upload-item").click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(filePath);
	await uploadResponse;
	await page.waitForFunction((fileName) => {
		return Array.from(document.querySelectorAll(".doc-item")).some((node) =>
			node.textContent?.includes(fileName),
		);
	}, filePath.split(/[\\/]/).pop() ?? "");
}
