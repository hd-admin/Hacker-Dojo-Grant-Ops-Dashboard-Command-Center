# Hacker Dojo Grant Ops Expanded Requirements and Acceptance Criteria

## Purpose

This document expands `PROMPT.md` into a full product requirements contract.

It treats `prototype.html` as a visual and workflow starting point only, not as the complete scope. The authoritative product scope is the combination of:

- `PROMPT.md`
- all workflows implied by a production-ready grant operations app
- all backend behavior required to make the UI real
- all testability, persistence, review, submission, and audit requirements needed for real-world use

This document also includes features that are not explicitly shown in the prompt or prototype but are required to make the app usable, supportable, recoverable, and trustworthy in real-world nonprofit operations.

## Product Goal

Build a production-ready, local-first grant operations application for Hacker Dojo that:

1. researches real grant opportunities relevant to Hacker Dojo,
2. crawls and stores real source data,
3. ranks and organizes opportunities by fit, deadline, and award value,
4. drafts grounded grant materials for human review,
5. manages the full submission workflow,
6. tracks follow-ups and outcomes,
7. operates end to end without fake data.

## Product Principles

1. No fake data in production flows.
2. Backend is a first-class requirement, not a support detail.
3. Human approval is required before submission.
4. Every AI-generated claim must be traceable to source material.
5. All workflows must be black-box testable.
6. Architecture must support strict linting, strict typechecking, dependency injection, and isolated I/O mocking in tests.
7. No dead code.
8. SQLite-backed persistence is required for this product scope.
9. Prototype visuals do not limit product scope.
10. Missing but necessary operational features must be added explicitly.

## Resolved Product Decisions

The following product choices are explicitly resolved for the current scope and must not be left to assumption during implementation:

1. This is a single-user desktop app.
2. This is a local-first app.
3. SQLite is the required persistence layer for the current scope.
4. Opencode is the required agent backend for research and drafting workflows in the current scope.
5. Prompt-driven source discovery is required.
6. Manual opportunity intake is required.
7. Background crawling is required.
8. Visible background job status is required.
9. Human approval before submission is required.
10. Claim-level grounding review is required before sign-off.
11. Automated portal submission is not required; manual submission support and submission evidence tracking are required.
12. Multi-user collaboration, role administration, and team account workflows are out of scope for the current version.
13. Local privacy and accidental-action protection are in scope; enterprise identity management is out of scope.
14. Unsupported or manual-only sources must remain usable through manual workflows rather than being treated as product failure.
15. Offline and degraded-mode behavior must be explicit, not inferred.

## Requirement Interpretation Rules

The following interpretation rules apply to the entire document:

1. No silent assumptions are allowed.
2. If data is missing, uncertain, ambiguous, stale, or conflicting, the UI must show that state explicitly rather than infer certainty.
3. If a capability is required, it must have explicit product behavior, acceptance criteria, and user-visible outcomes.
4. If a behavior is out of scope, it must be treated as out of scope rather than implemented implicitly.
5. If a workflow depends on human action outside the app, the app must name that dependency explicitly and guide the user through it.
6. If a workflow depends on AI or external systems, failure, delay, partial completion, and retry behavior must be explicit.
7. If the app cannot complete an action, it must preserve prior valid state and explain next steps.
8. User acceptance criteria describe required operator outcomes, not optional examples.
9. Where the document says “by default,” the default must be implemented intentionally and surfaced to the user where it affects trust, privacy, or submission behavior.
10. Sign-off is blocked if a feature appears implemented but its failure mode, recovery path, or operator-visible state is not explicitly defined.

## Primary User Model

### Primary User

- Single primary operator for Hacker Dojo grant operations

### User Responsibilities

The single user is expected to act in multiple capacities during a workflow, including:

- executive reviewer,
- grant researcher and operator,
- program fact contributor,
- budget coordinator,
- local app maintainer.

The product must support these different modes of work without assuming multiple simultaneous human users.

### Responsibility Tags, Not Multi-User Roles

Where the spec refers to finance, program, review, or maintenance responsibilities, those labels are workflow categories, checklist groupings, or reminder buckets for a single operator in the current scope.

## High-Level Workflow Map

The app must fully represent and support all of the following workflows:

1. First-run setup and environment verification
2. Opencode detection, compatibility check, and health handshake
3. Organization onboarding and profile setup
4. Prompt-driven source discovery and source approval
5. Source normalization and crawler configuration
6. Scheduled and manual crawl execution
7. Opportunity normalization and deduplication
8. Match scoring and ranking
9. Discovery review and filtering
10. Add-to-pipeline decision
11. Application dossier creation
12. Requirements checklist generation
13. Draft generation from real org documents and source evidence
14. Revision loop between human and agent
15. Approval and draft lock
16. Submission preparation and validation
17. Manual or assisted submission tracking
18. Follow-up task and communication tracking
19. Deadline monitoring and reminders
20. Outcome tracking: submitted, declined, awarded, closed
21. Manual opportunity intake for non-crawlable grants
22. Duplicate and conflict adjudication
23. Claim grounding review before approval
24. Offline and degraded-mode operation
25. Audit, export, and reporting
26. Backup, restore, and recovery
27. Runtime failure detection and operator recovery

## Comprehensive Feature Inventory

To make the app genuinely usable for a non-technical operator, the product must explicitly include all of the following:

1. first-run setup,
2. runtime health checks,
3. opencode detection,
4. opencode compatibility checks,
5. opencode connectivity checks,
6. guided organization onboarding,
7. saved organization profile,
8. document upload,
9. document indexing,
10. document versioning,
11. prompt-based source discovery,
12. human approval of discovered sources,
13. structured source registry,
14. source categorization,
15. background crawl scheduling,
16. manual crawl refresh,
17. visible crawl progress,
18. crawl health reporting,
19. crawl error reporting,
20. normalized grant records,
21. deduplication,
22. source provenance,
23. match scoring,
24. score explanations,
25. search theme tuning,
26. discovery filtering,
27. discovery export,
28. grant detail dossier,
29. requirements checklist generation,
30. task assignment,
31. pipeline state management,
32. dashboard reporting,
33. notifications,
34. activity feed,
35. AI-assisted drafting,
36. draft versioning,
37. draft review,
38. direct editing,
39. approval and lock,
40. submission readiness validation,
41. submission evidence tracking,
42. follow-up tracking,
43. outcome tracking,
44. manual opportunity intake,
45. duplicate/conflict review,
46. claim-level grounding review,
47. local access/privacy protections,
48. local persistence,
49. backup and restore,
50. opencode retry and recovery,
51. empty/loading/error states,
52. onboarding help and microcopy,
53. keyboard and accessibility support,
54. desktop-native behavior and conventions,
55. Apple HIG-aligned interaction patterns,
56. operator troubleshooting guidance,
57. strict verification and test coverage,
58. release readiness gates.

## Hidden Dependency Audit: Required Enabling Features

The following are make-or-break supporting features that may not look like headline product features but are required for the app to work well in practice:

1. background job orchestration for crawl, indexing, scoring, and drafting,
2. job queue visibility,
3. cancellation and retry controls,
4. credentials and secret management,
5. source-specific parser configuration,
6. unsupported-source handling,
7. file ingestion failure handling,
8. data migration for app upgrades,
9. schema migration for persisted records,
10. autosave and unsaved-change protection,
11. draft locking and concurrent-edit protection,
12. attachment packaging for submission,
13. exported artifact naming and organization,
14. recovery from partial operations,
15. manual override for automated decisions,
16. provenance for every AI-assisted output,
17. backup validation,
18. restore validation,
19. activity and error log retention,
20. support-oriented troubleshooting surfaces,
21. operating-system permission handling,
22. safe quit and restart behavior during active jobs,
23. source review and approval before crawl activation,
24. rate-limit, quota, and capacity handling,
25. saved working context and recent-item restoration.

## Core Functional Areas

---

## 0. Application Bootstrap, Setup, and Runtime Health

The app must help non-technical users reach a working state before they attempt grant work.

### Required Capabilities

- Detect whether required local services, storage paths, and dependencies are available.
- Detect whether opencode is installed, reachable, and compatible with the app's integration contract.
- Show first-run setup guidance in plain language.
- Show a persistent health view for core subsystems including storage, crawl engine, document indexer, and opencode connectivity.
- Support retry, repair guidance, and degraded mode when part of the system is unavailable.
- Clearly identify operator-owned setup items such as binary path, required backend configuration, and missing credentials/configuration prerequisites.

### Acceptance Criteria

- On launch, the app performs a non-destructive runtime health check before enabling workflows that depend on unavailable subsystems.
- If opencode is not installed or not detectable, the app shows a clear blocking or degraded-state message with recovery instructions.
- If the app cannot communicate with opencode, the app distinguishes that from “opencode not installed.”
- If storage cannot be opened, the app does not present the system as healthy.
- The app exposes subsystem status in human-readable language rather than only raw errors.
- Users can re-run health checks without restarting the app.

### User Acceptance Criteria

- A user can open the app and immediately understand whether it is ready to use.
- A user can recover from a broken runtime without reading developer logs first.
- A non-technical operator can tell the difference between “AI backend unavailable,” “crawler unavailable,” and “local data problem.”

---

## 0.5. Opencode Integration and Failure Handling

Opencode is a required backend dependency for agent-driven grant research and drafting workflows, so the product must explicitly manage that dependency.

### Required Capabilities

- Detect presence of opencode.
- Verify opencode version or capability compatibility.
- Verify transport connectivity between the app and opencode.
- Verify that required grant-research and drafting workflows can be invoked.
- Surface configuration issues such as missing path, failed startup, permission errors, timeouts, unavailable model access, or malformed responses.
- Surface capacity issues such as rate limits, quota exhaustion, or temporary backend unavailability.
- Distinguish environment/configuration failures from live runtime failures.
- Queue, retry, cancel, and restart long-running opencode-backed operations.
- Preserve user work when opencode becomes unavailable mid-task.
- Fall back to non-agent features where possible instead of making the whole app unusable.
- Log opencode request lifecycle metadata needed for support and debugging.
- Handle malformed or partially structured outputs, context overflow, and partial outputs from interrupted sessions as first-class failure states.

### Acceptance Criteria

- The app checks for opencode availability during startup and before launching an agent-dependent workflow.
- If opencode is missing, the app tells the user what functionality is unavailable and how to restore it.
- If opencode is installed but not reachable, the app shows communication-specific remediation steps.
- If an opencode task times out or fails, the app preserves the parent grant record and any prior completed outputs.
- If an opencode task is blocked by rate limit or quota exhaustion, the user sees a distinct actionable state rather than a generic failure.
- If an opencode task fails due to configuration, model availability, malformed output, context overflow, or interrupted session state, the user sees a distinct actionable state rather than a generic failure.
- The app prevents users from believing a draft or analysis completed successfully when the opencode call actually failed.
- Agent-backed operations expose progress, success, failure, retry, and cancellation states.
- The app records enough metadata to diagnose failures without exposing sensitive prompt contents unnecessarily.
- Non-agent flows such as browsing existing records, editing org profile data, and reviewing previously generated drafts remain available when opencode is down.
- The app distinguishes retryable throttling or transient failures from terminal failures requiring user action.

### User Acceptance Criteria

- A user can tell whether opencode is not installed, misconfigured, offline, timing out, or returning an error.
- A user does not lose already-saved grant work because the AI backend failed.
- A user can retry a failed research or drafting operation from the app.
- A maintainer can diagnose opencode-related failures from in-app status and logs.

---

## 0.75. Guided Usability, Learnability, and Operator Support

The app must be easy for a real nonprofit operator to learn and use without developer assistance.

### Required Capabilities

- Provide first-run guidance and explicit defaults documented in the UI.
- Explain core concepts like sources, discovery, pipeline, review, submission, and follow-up in plain language.
- Use progressive disclosure so novice users are not overwhelmed.
- Provide inline help, empty-state instructions, and recovery suggestions.
- Use autosave for long-form narrative editing and grant drafting surfaces, and use mandatory unsaved-changes warnings for structured forms where autosave is not applied.
- Confirm destructive actions.
- Preserve locally saved draft work across interruptions, and mark interrupted in-flight operations as incomplete rather than silently complete.

### Acceptance Criteria

- Empty states explain the next useful action.
- Forms and workflows use clear labels rather than relying only on placeholders.
- The app uses consistent navigation terms across screens.
- Destructive or irreversible actions require confirmation.
- Long-running operations provide progress feedback.
- Users can return to incomplete work without re-entering everything.

### User Acceptance Criteria

- A new operator can understand how to begin without needing a training call.
- A user can recover from mistakes like closing a panel, cancelling a draft, or navigating away from a screen.
- A user can tell what the primary action is on each major screen.

---

## 0.9. Apple HIG, Accessibility, and Desktop UX Quality

Because the app is intended for daily operational use on Apple platforms, the UX must follow Apple desktop conventions, accessibility expectations, and usability best practices rather than behaving like a rough web admin panel.

### Required Capabilities

- Use a desktop-native navigation model with a stable sidebar, content area, and detail context for the main application shell.
- Support full keyboard navigation for all major actions.
- Use visible focus states, descriptive labels, and accessible naming for controls.
- Prefer window- or context-specific modal behavior over disruptive app-wide blocking dialogs.
- Use progress indicators for long-running operations, especially crawling, indexing, and drafting.
- Use clear empty, loading, and failure states with next-step guidance.
- Use notification behavior appropriate to urgency instead of over-alerting the user.
- Preserve layout clarity, hierarchy, and readability for long-form grant content and dense operational tables.
- Respect macOS expectations for settings, confirmation dialogs, destructive actions, and state restoration.

### Acceptance Criteria

- All major workflows can be completed with keyboard navigation alone.
- Long-running operations show determinate progress when measurable and indeterminate progress when exact completion cannot be measured, and users can always tell whether the app is actively working.
- Destructive actions require confirmation and clearly describe consequence.
- Dialogs and sheets are scoped appropriately so the user is not blocked more broadly than necessary.
- Empty states explain what happened, why, and what the user can do next.
- Notifications distinguish informational events from urgent deadlines or failures.
- The app restores users to a sensible prior working context after restart where platform capabilities allow.
- Dense information views remain readable and navigable for non-technical users, including users relying on VoiceOver or keyboard-only interaction.

### User Acceptance Criteria

- A Mac user can operate the app in a way that feels consistent with other well-behaved desktop apps.
- A non-technical user does not feel lost when the app is busy, empty, or blocked.
- A keyboard-only or assistive-technology user can still review grants, approve drafts, and manage tasks.

## 1. Organization Profile and Grounding Repository

The app must maintain a complete, editable organization profile used by search, ranking, drafting, and checklist generation.

### Required Capabilities

- Store legal identity, EIN, nonprofit status, UEI/SAM identifiers, contact information, geography, mission, program areas, populations served, funding history, partnerships, and compliance facts.
- Store and version supporting documents such as impact reports, one-pagers, budgets, board rosters, logic models, evaluation plans, audited financials, and prior grant applications.
- Parse and index uploaded files for retrieval during drafting and fit analysis.
- Track document freshness, last-used timestamp, and source provenance.
- Allow users to mark documents as canonical, draft-only, archived, or restricted.
- Restricted documents remain visible only in explicit restricted-document views, are excluded from AI workflows by default, are excluded from exports by default, and are excluded from submission packages by default unless the user deliberately includes them for a specific workflow.

### Acceptance Criteria

- The system stores the org profile in persistent local storage and reloads it across restarts.
- Users can create, edit, archive, and restore organization facts without data loss.
- Uploaded documents are persisted locally, indexed, and discoverable by the drafting system.
- The system records which documents were used to generate a draft or recommendation.
- The system flags missing critical org data required by downstream grants.
- The system prevents submission-ready status when required org profile fields are missing.
- Restricted-document behavior is explicit and visible so the user knows whether a document is viewable, usable for drafting, or excluded from exports and submission packages.

### User Acceptance Criteria

- A user can update Hacker Dojo's mission, add a new budget file, and see that later drafts use the updated information.
- A user can tell which documents were used in a given draft without reading raw logs.
- A user can identify missing profile items before wasting time on a grant that needs them.

---

## 2. Source Management and Crawl Configuration

The app must manage real grant discovery sources and crawl them reliably.

### Required Capabilities

- Support prompt-driven source discovery for non-technical users, where a user can describe desired grants in plain language and the app proposes candidate sources and search strategies.
- Convert approved prompt-derived sources into structured internal source records that are easy to crawl, deduplicate, tag, schedule, and monitor.
- Support direct manual addition of sources in addition to prompt-driven source discovery.
- Support source categories such as federal, foundation, corporate, local, community, and custom.
- Support source metadata review including rationale, crawl method, activation state, and confidence before activation.
- Classify sources as crawlable, crawlable-with-auth, manual-only, or unsupported.
- Support crawl schedules, manual refresh, pause, resume, retry, and background execution.
- Store source metadata including URL, source type, auth method if any, crawl status, last success, last failure, and content freshness.
- Persist crawl snapshots or normalized extracted records for auditability.
- Detect source failures, stale sources, and repeated parsing errors.
- Provide a visible crawl activity surface that shows which source is being processed, current stage, progress, last run, next run, and failure reason.
- Provide source-level visibility so users can tell which individual sources succeeded, failed, were skipped, or need attention.
- Explain when a source should be handled manually rather than crawled, including compliance or access limitations.

### Acceptance Criteria

- A non-technical user can describe desired source types in natural language and the app can propose crawlable sources or source templates.
- When the user approves discovered sources, the app persists them as structured source records rather than leaving them as freeform prompt text.
- A user can add a real source and the system persists it.
- A manual crawl can be triggered from the app and results are stored.
- Scheduled crawls run in the background without requiring the user to stay on the source screen.
- Background crawls remain visible to the user through the dashboard, activity feed, and per-source status surfaces.
- The user can tell whether a crawl is queued, running, paused, succeeded, partially failed, or failed.
- The system records source-level success/failure state and error messages.
- The system records crawl results both at the run level and at the per-source level.
- Re-crawling an existing source updates the source record and does not create uncontrolled duplicates.
- The UI exposes crawl health, last sync time, and online/offline backend status.
- Manual-only or unsupported sources are clearly labeled and do not masquerade as crawler failures.

### User Acceptance Criteria

- A grant ops user can describe something like “find Bay Area education and STEM grants for nonprofits” and the app turns that into usable discovery sources.
- A grant ops user can add a new foundation grants page and see it included in later discovery results.
- A user can refresh a crawl and understand whether new opportunities were found.
- A user can leave the source screen, continue other work, and still see that crawling is progressing in the background.
- A user can see which source is failing and why, without digging into code.

---

## 3. Discovery, Normalization, and Deduplication

The app must convert crawled data into a reliable opportunity inventory.

### Required Capabilities

- Extract grant title, funder, program summary, eligibility, geography, award range, due dates, rolling status, required attachments, submission path, and source links.
- Normalize inconsistent source fields into a canonical schema.
- Deduplicate grants found across multiple sources.
- Preserve source citations and timestamps for each opportunity.
- Mark stale, changed, closed, reopened, and rolling opportunities.

### Acceptance Criteria

- Discovery records are stored in a canonical local database schema.
- Duplicate opportunities from multiple sources are collapsed into a single record with linked provenance.
- Each opportunity record retains its source URLs and crawl timestamps.
- The system can distinguish rolling deadlines from dated deadlines.
- Closed or expired grants do not appear in active match views by default and appear only in explicit historical or archived views.

### User Acceptance Criteria

- A user sees one opportunity for the same grant even when it came from multiple sources.
- A user can open an opportunity and verify where the information came from.
- A user can trust that expired grants are not mixed into active decision-making and appear only when the user enters a historical or archived view.

---

## 4. Match Scoring and Ranking

The app must assess grant fit against Hacker Dojo's profile and priorities.

### Required Capabilities

- Score opportunities across multiple factors such as mission alignment, geography, program fit, audience fit, budget fit, partnership readiness, compliance readiness, and timeline feasibility.
- Allow configurable scoring weights.
- Support search themes and concept clusters from the organization profile.
- Support ranking by best fit, nearest deadline, reward size, and newly discovered.
- Expose why a score was assigned.

### Acceptance Criteria

- Every surfaced opportunity includes a fit score and a factor-level explanation.
- Users can sort discovery results by fit, deadline, award size, and recency.
- Users can filter results by theme, funder type, and status.
- Score explanations reference real org facts and real grant requirements.
- Score recalculation happens when org profile data or weighting rules change.

### User Acceptance Criteria

- A user can understand why a grant scored 92 instead of 72.
- A user can quickly find high-fit, near-deadline opportunities.
- A user can trust that scoring is based on Hacker Dojo's real profile rather than generic nonprofit language.

---

## 5. Discovery Workspace

The discovery view must support active grant triage, not just display records.

### Required Capabilities

- Search across grants, funders, keywords, and tags.
- Filter by category, fit threshold, deadline window, source type, geography, and status.
- Export results.
- Open a detail view with fit rationale, requirements, sources, and next actions.
- Add an opportunity to the pipeline.
- Dismiss, snooze, archive, or watch an opportunity.

### Acceptance Criteria

- Users can search and filter discovery results without page corruption or stale state.
- Exported discovery data reflects the currently filtered result set.
- Selecting a grant opens a detail view populated from the stored record.
- Adding a grant to the pipeline creates a persistent application record linked to the discovery record.
- Dismissed or archived opportunities are tracked and reversible.

### User Acceptance Criteria

- A user can review newly found grants, open one, understand it, and add it to the pipeline in one flow.
- A user can ignore poor-fit grants without permanently losing the audit trail.
- A user can export a filtered list for leadership review.

---

## 6. Grant Detail View and Dossier

Every opportunity in active consideration must have a full dossier.

### Required Capabilities

- Show funder summary, award range, deadlines, fit breakdown, source citations, and current status.
- Show a generated requirements checklist.
- Show linked org facts that satisfy or fail requirements.
- Show generated draft previews and revision state.
- Show submission path and external links.
- Show unresolved blockers.

### Acceptance Criteria

- Opening a detail view shows the latest persisted opportunity data.
- The requirements checklist is generated from stored grant data plus org profile data.
- Checklist items include status, evidence source, and responsibility tag where applicable.
- Draft previews display the current approved or in-progress version, not stale content.
- External grant links open the correct source destination.

### User Acceptance Criteria

- A reviewer can open one grant and immediately know fit, gaps, draft readiness, and next steps.
- A user can see what is done, what is missing, and what evidence supports each requirement.

---

## 7. Pipeline Management

The app must provide a real operational pipeline, not a static board.

### Required Capabilities

- Maintain application states at minimum: matched, drafting, review, approved, submission-ready, submitted, follow-up, awarded, declined, closed, archived.
- Support state transitions with audit history.
- Support board and list views.
- Support responsibility tagging, due dates, comments, and blockers.
- Support filtering by responsibility tag, status, urgency, and funder type.

### Acceptance Criteria

- Each pipeline item persists independently from discovery records.
- State transitions are logged with timestamp and actor.
- The board count matches the underlying stored records.
- Users can move applications through the pipeline without losing checklist, draft, or history context.
- Closed and historical applications remain queryable.

### User Acceptance Criteria

- A single operator can see all active applications and know which ones are drafting, waiting on review, or already submitted.
- A single operator can reopen any pipeline item and recover its full history quickly.

---

## 8. Task and Checklist Management

The app must break application work into concrete, trackable items.

### Required Capabilities

- Generate required tasks from grant requirements.
- Support manual task creation.
- Assign tasks to the primary user with optional responsibility tags such as finance, program, review, or follow-up.
- Track due dates, completion state, evidence, notes, and dependencies.
- Support follow-up tasks after submission.

### Acceptance Criteria

- Each application can have a checklist and task list stored independently.
- Tasks can be marked blocked, in progress, completed, waived, or not applicable with justification.
- The system blocks submission-ready status when mandatory checklist items remain incomplete.
- Task completion can be linked to supporting files, notes, or external confirmation.

### User Acceptance Criteria

- A user can see exactly which tasks are left before a grant can be submitted.
- A user can tag the budget item as finance-related and the partnership letters as program-related to organize work clearly.
- A reviewer can distinguish completed work from work merely mentioned in notes.

---

## 9. AI-Assisted Draft Generation

The app must generate strong draft materials grounded in real evidence.

### Required Capabilities

- Use the organization profile, uploaded documents, grant requirements, and crawled source intelligence as drafting context.
- Support configurable voice and tone rules.
- Generate grant artifacts such as LOIs, executive summaries, narratives, project visions, budgets outlines, partner outreach drafts, and follow-up replies.
- Track grounding sources used for each generated section.
- Support revision instructions and regeneration.
- Use opencode-backed agent and prompt orchestration for grant research and drafting workflows.

### Acceptance Criteria

- Drafts are generated from stored real data and linked sources, not static sample text.
- Each draft stores version number, timestamp, generation input summary, and evidence sources.
- The system can regenerate a draft after user feedback without overwriting prior versions.
- The system supports auto-draft thresholds based on fit or rule configuration.
- The UI shows whether a draft is in progress, ready for review, approved, or locked.

### User Acceptance Criteria

- A reviewer can inspect a draft and see what org documents and grant sources informed it.
- A user can ask for a revision and receive a new version without losing the old one.
- A user can trust that the draft reflects Hacker Dojo's real voice and facts.

---

## 10. Human Review, Approval, and Editing

Human review is mandatory before submission.

### Required Capabilities

- Preview generated drafts.
- Request revisions with instructions.
- Edit drafts directly.
- Approve and lock drafts.
- Record approver identity, time, and approval notes.
- Prevent untracked changes after lock. Reopening a locked draft requires an explicit reopen action, records a reason, preserves the locked version, and creates a new editable working version.

### Acceptance Criteria

- A draft can be marked approved only through an explicit human approval action.
- Once locked, the system prevents silent modification of the approved version.
- Revisions create new versions with lineage.
- Approval state is visible throughout the pipeline and dossier.

### User Acceptance Criteria

- An executive reviewer can approve a draft and know exactly which version is the approved one.
- A user can request revision feedback like “reduce jargon and emphasize community outcomes” and see that request preserved in history.

---

## 11. Submission Preparation and Execution

The app must support actual submission readiness, not just drafting.

### Required Capabilities

- Validate that all required materials are present.
- Generate a submission package manifest.
- Track submission instructions, portal URLs, file constraints, and due dates.
- Support manual submission recording and submission runbook guidance for external portal or email submission steps.
- Capture confirmation numbers, timestamps, and uploaded package versions.
- Notify humans about any step that must be completed outside the app.

### Acceptance Criteria

- The system cannot mark an application submitted without recording submission evidence.
- Required checklist gaps prevent transition to submission-ready.
- Submission records include who submitted, when, how, and what confirmation was received.
- Applications needing external portal work still produce a clear submission runbook.

### User Acceptance Criteria

- A user can tell whether a grant is truly ready to submit or only nearly ready.
- A user can record a portal submission confirmation and later retrieve it.
- A user is explicitly notified when human intervention is needed for portal login, attachments, or external forms.

---

## 12. Follow-Up Management

The app must continue after submission.

### Required Capabilities

- Track post-submission requests, clarifications, interviews, missing materials, and reporting obligations.
- Create follow-up tasks and reminders.
- Draft response emails or supplemental materials.
- Track outcomes such as awarded, declined, withdrawn, or closed.

### Acceptance Criteria

- Submitted applications can enter a follow-up state with persisted tasks.
- The system stores follow-up deadlines, responsibility tags, and communication notes.
- Outcomes remain linked to the original grant record for reporting and future learning.

### User Acceptance Criteria

- A user can manage post-submission work in the same app instead of switching to ad hoc spreadsheets.
- A user can see the final outcome and any required next steps.

---

## 12.5. Manual Opportunity Intake

The app must support grants and opportunities that cannot be discovered cleanly through automated crawling.

### Required Capabilities

- Create an opportunity manually from an email, phone call, PDF, forwarded link, portal notice, or relationship-based lead.
- Mark manually entered opportunities as manually sourced while still allowing them to enter the same discovery and pipeline workflows.
- Attach source evidence such as uploaded files, pasted notes, screenshots, links, and operator summaries.
- Record who entered the opportunity, when it was entered, and what evidence supports it.

### Acceptance Criteria

- A user can create a grant opportunity without first creating a crawlable source.
- Manually created opportunities are clearly labeled as manual-origin records.
- Manual intake records can still be scored, reviewed, drafted, submitted, and audited.
- The app distinguishes operator-entered facts from crawler-extracted facts.

### User Acceptance Criteria

- A user can capture a promising grant from an email or PDF the same day they hear about it.
- A user is not blocked from working a grant just because the crawler cannot access it.

---

## 12.6. Duplicate and Conflict Adjudication

The app must handle ambiguous or conflicting source information explicitly.

### Required Capabilities

- Flag likely duplicates for review when confidence is low.
- Show conflicting values such as deadline, award amount, eligibility, or submission method side by side.
- Allow the user to merge, keep separate, or defer a conflict decision.
- Preserve the provenance of conflicting claims even after a canonical decision is made.

### Acceptance Criteria

- Low-confidence deduplication does not silently merge records without visibility.
- The user can inspect conflicting source data before confirming a canonical value.
- A canonical resolution is stored with audit history.
- Conflicted records are clearly marked until resolved.

### User Acceptance Criteria

- A user can tell when the system is uncertain about whether two records are the same grant.
- A user can resolve conflicting source facts without losing the original evidence trail.

---

## 12.7. Claim-Level Grounding Review

The app must make AI-generated content reviewable at the claim or section level, not only at the whole-draft level.

### Required Capabilities

- Show which evidence sources support each major draft section or claim cluster.
- Flag unsupported, weakly grounded, or stale sections before approval.
- Allow the user to inspect evidence from within the review workflow.
- Block or warn on approval when grounding quality falls below configured expectations.

### Acceptance Criteria

- A reviewer can inspect section-level grounding for a generated draft without leaving the app.
- The app distinguishes grounded content from unsupported or weakly supported content.
- Approval workflows surface grounding gaps clearly before a draft is locked or submitted.
- Grounding review state is preserved in audit history.

### User Acceptance Criteria

- A user can answer “where did this statement come from?” for the key parts of a draft.
- A user does not have to trust the agent blindly just because a source list exists somewhere in the record.

---

## 12.8. Offline and Degraded-Mode Operation

Because the app is local-first, it must behave predictably when networked or agent-dependent capabilities are unavailable.

### Required Capabilities

- Distinguish fully offline mode, partial degraded mode, and fully online mode.
- Allow continued access to already stored local data when network or opencode-dependent features are unavailable.
- Label stale or not-yet-refreshed data clearly.
- Explain which actions can continue immediately, which must wait, and which are unavailable until recovery.
- Surface reconnection or recovery state in plain language.
- Preserve enough local working context that the user can resume meaningful work without rebuilding their place after a temporary outage.

### Acceptance Criteria

- The user can still browse and manage locally stored grants, drafts, documents, and tasks when online dependencies are down.
- Discovery freshness is labeled when crawl-dependent data is stale.
- Agent-dependent actions show deferred or unavailable states clearly.
- Recovery from degraded mode updates the user-visible system state without ambiguity.
- The app distinguishes stale local data from newly refreshed data after recovery.

### User Acceptance Criteria

- A user can keep working locally even when the crawler or AI backend is unavailable.
- A user can tell which information is current versus stale.

## 13. Notifications, Activity, and Reminders

The app must actively surface operational risk.

### Required Capabilities

- Notify on new matches above threshold.
- Notify on upcoming deadlines.
- Notify on completed drafts, failed crawls, missing requirements, and follow-up needs.
- Provide an activity feed.
- Support email or local desktop notification channels.
- Respect urgency and user attention by avoiding intrusive alerts for routine events.

### Acceptance Criteria

- Notification rules are configurable and persisted.
- The activity feed is backed by real event records.
- Important events include timestamps and entity links.
- Users can distinguish informational, warning, and urgent events.
- Routine background crawl progress appears in-app without requiring disruptive system notifications.
- Time-sensitive or high-risk events such as imminent deadlines, repeated crawl failures, or blocking submission issues are distinguishable from normal updates.
- Deadline reminders account for explicit deadline semantics such as known cutoffs, rolling deadlines, and uncertain deadline confidence where source data is incomplete.

### User Acceptance Criteria

- A user gets notified when a high-fit grant is found.
- A reviewer can see when a draft was completed and when a deadline is approaching.
- A maintainer can see when crawling has failed.

---

## 14. Dashboard and Reporting

The dashboard must reflect real operational data.

### Required Capabilities

- Show total active pipeline value.
- Show next deadline.
- Show drafted-and-ready counts.
- Show newly matched grants.
- Show upcoming deadlines, review queue, and recent activity.
- Support exports and historical reporting.
- Show current crawl or sync health at a glance.
- Show stale-data risk when discovery information is old or recent crawl activity failed.

### Acceptance Criteria

- KPI values are derived from persisted pipeline and discovery data.
- Dashboard cards update after relevant actions without requiring manual data editing.
- Historical reporting can distinguish active, submitted, awarded, declined, and archived applications.
- The dashboard exposes enough crawl status information for a user to know whether discovery data is fresh or stale.
- The dashboard distinguishes firm deadlines from estimated or uncertain deadlines when the source data is ambiguous.

### User Acceptance Criteria

- A single operator can open the app and immediately understand current grant pipeline health.
- The operator can use the dashboard to prioritize today’s work.

---

## 15. Search Themes and Tuning

Users must be able to steer the system toward Hacker Dojo’s priorities.

### Required Capabilities

- Configure keyword clusters, themes, regions, populations, and strategic priorities.
- Adjust matching thresholds and auto-draft thresholds.
- Maintain inclusion and exclusion rules.

### Acceptance Criteria

- Theme configuration changes persist and influence future matching.
- Threshold changes affect later match decisions and draft automation rules.
- Users can review current matching policy without opening code.

### User Acceptance Criteria

- A user can add “workforce development” or “AI literacy” as strategic themes and see that reflected in future recommendations.

---

## 16. Search, Filter, Sort, and Export

The app must support real operational retrieval of data.

### Acceptance Criteria

- Users can search discovery, pipeline, and tasks using meaningful filters.
- Sorting supports fit, deadline, award, recency, and status where relevant.
- Export formats include at minimum CSV for discovery and pipeline records.
- Exported output matches the filtered data the user is viewing.

### User Acceptance Criteria

- A user can produce a CSV of all foundation grants with fit over 80 and deadlines within 60 days.

---

## 17. Local Access, Privacy, and Safe Use

Because this is a single-user desktop app, the priority is local privacy, accidental-action prevention, and protection of sensitive grant data rather than multi-user authorization.

### Acceptance Criteria

- The app uses a single-user local access model with explicit safeguards against accidental high-impact actions.
- Sensitive files and stored records remain local to the app environment and are not exposed through unauthenticated network surfaces.
- The app prevents accidental destructive or high-impact actions through explicit confirmation dialogs and workflow gates.
- Draft approval and submission actions are clearly separated so the single user cannot accidentally submit when they only intended to review or edit.
- The app provides a configurable local app lock or launch passcode as a single-user privacy feature rather than a multi-user account system.

### User Acceptance Criteria

- A single operator can safely use the app without accidentally submitting the wrong grant state.
- Sensitive grant materials are not casually exposed on the local machine beyond the limits of the chosen environment.

---

## 18. Persistence, Backup, and Recovery

Local reliability is a core requirement.

### Acceptance Criteria

- Core records are persisted in SQLite.
- Uploaded files and generated outputs are persisted and linked to database records.
- The app supports backup and restore of the full working dataset.
- After app restart, the user returns to the same operational state without silent data loss.
- Backup and restore flows validate the integrity of restored database and associated stored files.
- The app shows backup freshness and the result of the last successful backup or restore verification in plain language.
- The app warns before risky operations when no recent backup exists.

### User Acceptance Criteria

- A user can close and reopen the app and still see all sources, grants, drafts, and pipeline history.
- A maintainer can recover from local corruption using a supported backup path.
- A non-technical user can tell whether their local data has been backed up recently enough to feel safe continuing work.

---

## 19. Auditability and Traceability

The app must be accountable.

### Acceptance Criteria

- The system records major events including crawl runs, match creation, score changes, draft generations, approvals, submissions, and follow-up updates.
- Drafts, checklists, and decisions are traceable to sources and actors.
- Users can inspect who changed what and when for critical records.

### User Acceptance Criteria

- A reviewer can answer “why did we submit this?” and “what evidence was this draft based on?” from inside the app.

---

## 20. Local Runtime Environment Requirements

The app must run reliably in its intended local environment even if formal macOS distribution packaging is not part of scope.

### Acceptance Criteria

- The app runs end to end on its supported local runtime environment without depending on fake hosted services.
- Local persistence paths are deterministic and documented.
- Runtime prerequisites for crawling, parsing, and storage are provisioned as part of the supported local runtime setup and verified in-app during setup and health checks.
- The user can start, stop, and verify backend services from the local runtime environment.

### User Acceptance Criteria

- A non-developer operator can install the app, launch it, and use it without manually wiring together backend pieces.

---

## 21. AI/Agent Backend Requirements

Agentic workflows are part of the product, not incidental tooling.

### Acceptance Criteria

- Opencode-backed agent workflows support grant research, source synthesis, fit analysis, and draft generation.
- Prompt and agent execution paths are configurable and testable.
- AI execution stores enough metadata for replay, debugging, and audit.
- Agent failures do not silently corrupt application state.
- Human-visible errors are produced when the agent cannot complete a task.
- Structured-output failures, partial-output failures, and context-overflow failures are handled distinctly.

### User Acceptance Criteria

- A user can trust that agent outputs came from a controlled, inspectable workflow.
- A maintainer can diagnose why a crawl, fit analysis, or draft generation failed.

---

## 22. Error States, Empty States, and Resilience

The app must behave safely when things go wrong.

### Acceptance Criteria

- Empty discovery states explain what to do next.
- Failed crawl states identify the failing source and error class.
- Missing document states tell users what document or fact is blocking progress.
- Interrupted draft generation does not destroy prior drafts.
- Partial submission prep clearly distinguishes complete from incomplete artifacts.
- Partial crawl results clearly distinguish “some sources succeeded” from “the crawl fully succeeded.”
- Unsupported or unparseable sources clearly explain whether they need manual handling, configuration, or source replacement.

### User Acceptance Criteria

- A user is never left guessing whether the system is empty, broken, or still working.

---

## 23. Testing and Verification Requirements

The prompt makes testability a hard requirement.

### Acceptance Criteria

- All core business workflows are black-box testable.
- Tests mock I/O and external dependencies appropriately.
- Architecture uses dependency injection where needed to isolate side effects.
- Strict linting and strict typechecking pass with no escape hatches.
- Backend workflows for crawling, storage, matching, drafting orchestration, and submission state management are extensively tested.
- End-to-end tests cover the major user workflows.

### User Acceptance Criteria

- The team can verify core behavior before release without depending on live external systems during test runs.
- Regressions in grant discovery, drafting, or state transitions are caught before shipping.

---

## 24. Explicit Non-Functional Requirements

### Performance
- Discovery and pipeline views must load from local persisted data without unacceptable delay for a realistic working set.

### Reliability
- The system must tolerate crawl failures, parsing failures, and agent failures without corrupting saved work.

### Maintainability
- No dead code.
- Strong typing.
- Clear module boundaries.
- Dependency-injected core services.

### Observability
- Logs and activity records must be sufficient to debug crawl, scoring, drafting, and submission issues.

### Data Integrity
- The system must avoid silent overwrites, duplicate records, and orphaned files.

### Deadline Semantics
- The system must represent deadline date, time, time zone, confidence, and rolling/ambiguous status. If a source does not provide one of these fields, the missing field must be shown as unknown rather than inferred.
- When exact deadline timing is unknown, the uncertainty must be visible to the user rather than silently treated as a firm cutoff.

---

## End-to-End Workflow Acceptance Criteria

## Workflow A: Initial Setup

### Acceptance Criteria
- A new user can enter org profile details, upload grounding documents, configure themes, test required backend dependencies, and save settings.
- The app validates missing required setup information before allowing full operations.
- The setup flow makes clear which items are required, which are optional, and whether the app is fully ready, partially ready, or blocked.

### User Acceptance Criteria
- A new Hacker Dojo operator can complete onboarding without reading the codebase.
- A non-technical operator can tell when setup is complete enough to start real work.

## Workflow B: Run Discovery

### Acceptance Criteria
- A user can trigger a crawl, store results, view new opportunities, and inspect source-backed details.

### User Acceptance Criteria
- A grant ops user can discover real grant opportunities from configured sources in one session.

## Workflow C: Triage and Add to Pipeline

### Acceptance Criteria
- A user can search, filter, inspect, and move a promising opportunity into the active application pipeline.

### User Acceptance Criteria
- A user can confidently decide which grants deserve drafting effort.

## Workflow D: Draft Creation and Review

### Acceptance Criteria
- The system generates a grounded draft, exposes evidence, supports revision requests, and records approval.

### User Acceptance Criteria
- A reviewer can turn a good match into a reviewable draft without copy-pasting source material by hand.

## Workflow E: Checklist Completion and Submission Readiness

### Acceptance Criteria
- The app identifies missing attachments, assignments, approvals, and budget inputs before submission-ready status.

### User Acceptance Criteria
- A user knows exactly what is still blocking submission.

## Workflow F: Submit and Record Evidence

### Acceptance Criteria
- The app supports submission prep, records submission evidence, and transitions the application into post-submission tracking.

### User Acceptance Criteria
- A user can later prove when and how a grant was submitted.

## Workflow G: Follow-Up and Outcome Tracking

### Acceptance Criteria
- The app tracks clarifications, follow-ups, decisions, and final award outcomes.

### User Acceptance Criteria
- A user does not lose visibility after submission.

## Workflow H: Operational Oversight

### Acceptance Criteria
- Dashboard, notifications, tasking, and activity feed reflect live operational state.
- Operational oversight includes clear visibility into stale data, active jobs, blocked workflows, and unresolved conflicts.

### User Acceptance Criteria
- A single operator can use the app as the operational source of truth.

---

## Critical Hidden Dependencies and Usability Enablers

This section captures supporting requirements that, if missing, would materially break usability, trust, or day-to-day operability.

### Background Job Orchestration

#### Acceptance Criteria
- Crawling, indexing, scoring, and draft generation are managed as background jobs rather than blocking the entire interface.
- The user can see active, queued, completed, cancelled, and failed jobs in a unified job status surface.
- Long-running jobs expose start time, current stage, last update, and result state.
- Users can cancel or retry eligible jobs without corrupting related grant records.

#### User Acceptance Criteria
- A user can continue reviewing grants while background work proceeds.
- A user can tell whether the system is busy, stuck, or done.

### Safe Quit, Restart, and Interruption Handling

#### Acceptance Criteria
- If the user closes the app during active background work, the app warns appropriately when work could be lost or left ambiguous.
- Restarting the app after interruption restores job state as completed, failed, cancelled, or explicitly marked not resumable.
- The app never leaves the user uncertain whether a draft, crawl, or submission prep operation finished.

#### User Acceptance Criteria
- A user can reopen the app after an interruption and understand what completed and what still needs attention.

### Credentials and Secret Management

#### Acceptance Criteria
- Any source or integration needing credentials has a supported secure configuration flow.
- The app never stores credentials in plain visible operational fields.
- Credential failures are reported as credential problems, not as generic crawl failures.

#### User Acceptance Criteria
- A maintainer can fix a source login or integration problem without editing config files by hand.

### Operating-System Permissions and Trust Prompts

#### Acceptance Criteria
- If the app needs notification permission, file access, or other OS-mediated permissions, it asks in context and explains why.
- Permission denial does not produce a confusing generic failure; the app explains the consequence and recovery path.

#### User Acceptance Criteria
- A non-technical user can recover from a denied permission without guessing what broke.

### File Ingestion and Document Reliability

#### Acceptance Criteria
- The app detects unsupported document types, corrupt files, and parsing failures.
- The app reports which file failed and why.
- A failed document ingest does not break unrelated records.
- The app supports document version tracking or replacement history so users can tell which uploaded artifact is current.

#### User Acceptance Criteria
- A user can tell when a bad upload failed instead of assuming the document was successfully indexed.

### Data and Schema Migration

#### Acceptance Criteria
- App upgrades handle stored data migrations safely.
- Migration failures are recoverable and do not silently destroy local records.
- Users are warned before any repair or migration action that could affect stored data.

#### User Acceptance Criteria
- A user can update the app without losing history, drafts, or stored sources.

### Source Review and Approval Before Activation

#### Acceptance Criteria
- Prompt-derived sources are reviewable before they are activated for crawling.
- Users can edit, reject, approve, or categorize suggested sources before background crawling begins.
- The app shows why a source was suggested and what it will be used for.

#### User Acceptance Criteria
- A user can approve source discovery suggestions confidently instead of blindly trusting the system.

### Autosave, Draft Safety, and Unsaved Change Protection

#### Acceptance Criteria
- User-entered edits are autosaved or explicitly protected by unsaved-change warnings.
- The app prevents silent loss of review comments, profile edits, or draft edits during navigation, restart, or transient failure.
- Locked drafts cannot be silently overwritten.

#### User Acceptance Criteria
- A reviewer does not lose half an hour of revision work because they switched screens or the app restarted.

### Submission Packaging and Artifact Management

#### Acceptance Criteria
- The app can assemble, name, and track submission artifacts consistently.
- The app records exactly which file versions were used for a submission.
- Exported or submission-bound files are organized in a way a non-technical user can find later.
- The app supports a clear submission package view or manifest that shows all required and included artifacts before submission.

#### User Acceptance Criteria
- A user can locate the final LOI, budget, and attachments used for a specific submission without hunting through random folders.

### Manual Override and Human Control

#### Acceptance Criteria
- Users can override automated categorization, scoring, or task generation with a recorded rationale.
- The app clearly distinguishes automated suggestions from human-confirmed decisions.

#### User Acceptance Criteria
- A user can correct the system when its recommendation is directionally wrong without fighting the tool.

### Rate Limits, Quotas, and Capacity Handling

#### Acceptance Criteria
- The app detects opencode capacity failures, timeouts, and rate-limit or quota exhaustion.
- Source crawling respects configured rate limits and does not hammer external sources irresponsibly.
- Capacity-related failures are surfaced distinctly from logic or connectivity failures.

#### User Acceptance Criteria
- A user can tell whether a job failed because the service is busy, the quota is exhausted, or the system is simply broken.

### Saved Working Context and Recent-Item Restoration

#### Acceptance Criteria
- The app remembers recently opened grants, drafts, filters, and active working context for the primary working surfaces.
- Returning users can quickly resume prior work without manually rebuilding context.

#### User Acceptance Criteria
- A user can reopen the app and get back to the grants they were just reviewing.

### Supportability and Troubleshooting

#### Acceptance Criteria
- The app provides user-facing diagnostics for storage, crawling, opencode connectivity, and document indexing.
- Support-relevant errors can be copied or exported for troubleshooting.
- Operational logs retain enough information to explain why a workflow failed.

#### User Acceptance Criteria
- A staff member can give useful failure details to a maintainer without needing terminal access.

---

## Feature Gaps Explicitly Implied by PROMPT.md

The following are required even if they are only partially or not visibly represented in `prototype.html`:

1. Real backend crawling and storage
2. Real source management
3. Real local persistence and restart durability
4. Real document indexing and grounding
5. Deduplication and canonical data modeling
6. Full checklist/task system
7. Human approval enforcement
8. Submission evidence tracking
9. Post-submission follow-up workflows
10. Audit logs and provenance
11. Authentication and role control
12. Backup and restore
13. Robust error handling and operational visibility
14. End-to-end testing and backend test depth
15. Production packaging for desktop distribution

---

## Release Readiness Gate

The app is not considered complete unless all of the following are true:

- The UI is backed by real persisted data.
- Discovery uses real crawled source data.
- Source discovery is usable by non-technical users through prompts, and approved results are converted into structured crawlable source records.
- Crawling runs in the background and remains visible to the user while it runs.
- Manual opportunity intake exists for non-crawlable or manually sourced grants.
- Duplicate/conflict review exists for ambiguous or contradictory source data.
- Grant matching and scoring are explainable.
- Drafts are generated from real organization and source evidence.
- Claim-level grounding review exists before approval or submission.
- Opencode availability, compatibility, and failure modes are surfaced clearly.
- Offline and degraded-mode behavior is explicit enough that the user can keep working safely with local data.
- Human review and approval are enforced.
- Submission workflows are operationally trackable.
- Follow-ups and outcomes are tracked.
- Hidden dependency features such as autosave, job visibility, troubleshooting, and migration safety are present.
- Strict lint, strict typecheck, backend tests, and end-to-end tests pass.
- No fake data is required for normal production use.

## Summary

`prototype.html` defines only a visible slice of the product. The actual app must be a full grant operations system with a real backend, durable local persistence, grounded AI-assisted drafting, human review controls, submission and follow-up workflows, and production-grade verification.
