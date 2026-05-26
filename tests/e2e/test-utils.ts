import type { APIRequestContext, Page } from "@playwright/test";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetAppState(request: APIRequestContext): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		try {
			const response = await request.post(
				"http://localhost:3000/api/testing/reset",
			);
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

export async function saveProfileThroughSettingsView(
	page: Page,
	mission: string,
): Promise<void> {
	await openSettingsView(page);
	await page.getByRole("button", { name: "Edit profile" }).click();
	const organizationCard = page
		.locator(".setting-card")
		.filter({ hasText: "Organization" });
	await organizationCard.locator("textarea").first().fill(mission);
	const saveProfileResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/profile") &&
			response.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Save changes" }).click();
	await saveProfileResponse;
	await page.locator("button", { hasText: "Edit profile" }).waitFor({ state: "visible" });
	await page.waitForFunction((expectedMission) => {
		const cards = Array.from(document.querySelectorAll(".setting-card"));
		const organization = cards.find((node) => node.textContent?.includes("Organization"));
		return Boolean(organization?.textContent?.includes(expectedMission));
	}, mission);
}

export async function configureOpencodeThroughSettingsView(
	page: Page,
	binaryPath: string,
	workingDirectory: string,
): Promise<void> {
	await openSettingsView(page);
	await page.getByRole("button", { name: "Configure" }).click();
	const opencodeCard = page
		.locator(".setting-card")
		.filter({ hasText: "Opencode Agent" });
	await opencodeCard.locator("input").nth(0).fill(binaryPath);
	await opencodeCard.locator("input").nth(1).fill(workingDirectory);
	await opencodeCard.locator("input").nth(2).fill("60000");
	await opencodeCard.locator("input").nth(3).fill("default");
	const saveOpencodeResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/opencode-settings") &&
			response.request().method() === "PUT",
	);
	await opencodeCard.getByRole("button", { name: "Save" }).click();
	const opencodeResponse = await saveOpencodeResponse;
	const opencodeRequestBody = opencodeResponse.request().postData() ?? "";
	if (!opencodeRequestBody.includes('"isConfigured":true')) {
		throw new Error(`Expected Opencode save payload to mark configured, got: ${opencodeRequestBody}`);
	}
	await page.locator(".setting-card").filter({ hasText: "Opencode Agent" }).getByText("Configured").waitFor({ state: "visible" });
	await page.waitForFunction((expectedPath) => {
		const cards = Array.from(document.querySelectorAll(".setting-card"));
		const opencode = cards.find((node) => node.textContent?.includes("Opencode Agent"));
		return Boolean(opencode?.textContent?.includes(expectedPath));
	}, binaryPath);
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
