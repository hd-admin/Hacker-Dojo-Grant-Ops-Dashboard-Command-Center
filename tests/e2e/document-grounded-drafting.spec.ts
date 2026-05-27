import fs from "node:fs/promises";
import path from "node:path";
import {
	type APIRequestContext,
	expect,
	type Page,
	test,
} from "@playwright/test";
import { configureOpencodeThroughSettingsView, resetAppState, saveProfileThroughSettingsView, uploadDocumentThroughSettingsView } from "./test-utils";

const fixturePath = path.join(
	process.cwd(),
	"tests/fixtures/documents/hacker-dojo-program-summary.pdf",
);
const opencodeStubPath = path.join(process.cwd(), "tests/e2e/opencode-stub.sh");
const exactSentence =
	"Hacker Dojo expands access to technology education and community innovation in Silicon Valley.";

async function ensureOpencodeStub(): Promise<string> {
	const script = `#!/bin/sh
set -eu

all_args="$*"
json_output=0
case "$all_args" in
	*"Research grants for the following organization:"*|*"--output-format json"*|*"--format json"*)
		json_output=1
		;;
esac

if [ "$json_output" -eq 1 ]; then
	cat <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"Education Technology Community Grant","funder":"Mock Foundation","funderShort":"Mock","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":82,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[],"rationale":"E2E research stub response"}
EOF
else
	cat <<'EOF'
## Hacker Dojo Grant Proposal

Hacker Dojo expands access to technology education and community innovation in Silicon Valley.

This draft is grounded in the uploaded organization profile and includes the grounded sentence exactly once.
EOF
fi
`;
	await fs.writeFile(opencodeStubPath, script, "utf8");
	await fs.chmod(opencodeStubPath, 0o755);
	return opencodeStubPath;
}


async function openMatchedGrantWithoutDraft(
	page: Page,
	request: APIRequestContext,
) {
	const grantsResponse = await request.get("http://localhost:3000/api/grants");
	expect(grantsResponse.ok()).toBeTruthy();
	const grants: Array<{
		id: string;
		title: string;
		fit: number;
		status: string;
		draftContent?: string;
	}> = await grantsResponse.json();

	const targetGrant = grants.find(
		(grant) => grant.status === "matched" && !grant.draftContent,
	);
	expect(targetGrant).toBeDefined();
	if (!targetGrant) {
		throw new Error("Expected a matched grant without draft content");
	}

	const sortedGrants = [...grants].sort((a, b) => b.fit - a.fit);
	const selectedIndex = sortedGrants.findIndex(
		(grant) => grant.id === targetGrant.id,
	);
	expect(selectedIndex).toBeGreaterThan(-1);

	await page.click('[data-view="discovery"]');
	await page.locator(".grants-row:not(.header)").nth(selectedIndex).click();
	await expect(page.locator(".drawer-title")).toHaveText(targetGrant.title);
	return targetGrant;
}

test("document-grounded-drafting: generate, revise, approve, and submit through the drawer", async ({
	page,
	request,
}) => {
	const stubPath = await ensureOpencodeStub();

	await resetAppState(request);
	await page.goto("http://localhost:3000");
	await page.waitForSelector(".app", { timeout: 20000 });

	await saveProfileThroughSettingsView(
		page,
		"Community innovation and education with maker pathways.",
	);
	await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
	await uploadDocumentThroughSettingsView(page, fixturePath);

	const targetGrant = await openMatchedGrantWithoutDraft(page, request);

	await expect(page.locator('button:has-text("Generate draft")')).toBeVisible();
	await page.getByRole("button", { name: "Generate draft" }).click();
	await expect(page.locator(".draft-preview")).toContainText(exactSentence);
	await expect(page.locator(".ai-badge")).toContainText("Drafted by agent");
	await expect(page.locator(".drawer")).toContainText(/\d+ words · \d+ pages/);

	await page.getByRole("button", { name: "Request revision" }).click();
	await page
		.locator("textarea.form-input")
		.first()
		.fill("Please tighten the budget section and keep the grounding sentence.");
	await page.getByRole("button", { name: "Save revision" }).click();
	await expect(page.locator(".drawer")).toContainText("Last revision note:");

	await page.getByRole("button", { name: "Approve & lock" }).click();
	await expect(
		page.getByRole("button", { name: "Submit" }).first(),
	).toBeVisible();

	await page.locator(".drawer-actions").getByRole("button", { name: "Submit" }).click();
	await page
		.locator(".drawer-section")
		.filter({ hasText: "Submit grant" })
		.locator("select")
		.selectOption("email");
	await page
		.locator('input[placeholder="Confirmation ID"]')
		.fill(`PW-${Date.now()}`);
	await page
		.locator('textarea[placeholder="Submission notes"]')
		.fill("Submitted from the drawer workflow");
	await page
		.locator(".drawer-section")
		.filter({ hasText: "Submit grant" })
		.getByRole("button", { name: "Submit" })
		.click();

	await page.click('[data-view="notifications"]');
	await expect(page.locator("body")).toContainText(targetGrant.funder);
	await expect(page.locator("body")).toContainText("Email submission sent to");

	await page.click('[data-view="tasks"]');
	await expect(page.locator("body")).toContainText("Follow up on email submission");
});
