import type { APIRequestContext } from "@playwright/test";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetAppState(request: APIRequestContext): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		try {
			const response = await request.post(
				"http://127.0.0.1:3000/api/testing/reset",
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
