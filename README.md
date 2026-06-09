# Hacker Dojo Grant Operations Center

A local-first, single-user grant management application for Hacker Dojo. Research funding opportunities, track deadlines, draft applications with AI assistance, and manage the full submission workflow — all from one place.

## Quick Start

### Prerequisites

- **Node.js** 24.x (Active LTS) or newer
- **pnpm** (recommended, install with `npm install -g pnpm`) or **npm** (comes with Node.js)
- **OpenCode CLI** (for AI-powered research and drafting — [install guide](https://opencode.ai))

### Run the App

With pnpm (recommended):

```bash
pnpm install
pnpm dev
```

Or with npm:

```bash
npm install
npm run dev
```

Open [http://localhost:855](http://localhost:855).

That's it. Your data lives in `.grant-ops-data/` (SQLite database and uploaded documents). Nothing leaves your machine.

> **Troubleshooting:** If the app fails to start, run `bash scripts/setup-check.sh` to diagnose common issues. If `better-sqlite3` needs rebuilding for your Node version, run `pnpm install` to use the prebuilt binary; pnpm's `onlyBuiltDependencies` setting in `.pnpmrc` handles the rebuild automatically.

### New in this version?

A new operator only needs to run `pnpm install` (or `npm install`) followed by `pnpm dev` (or `npm run dev`). The package manager rebuilds `better-sqlite3` against your Node version automatically via the `onlyBuiltDependencies` setting in `.pnpmrc`. If `better-sqlite3` still fails to load (e.g., the prebuilt binary does not match your Node ABI), run `pnpm rebuild better-sqlite3` (or `npm rebuild better-sqlite3`) and try again. There are no `predev`/`prebuild`/`prestart`/`prepare` shims — `pnpm dev` starts the app directly. The no-shim invariant is locked in by `tests/no-predev-shim.test.ts` and exercised end-to-end by `tests/e2e/fresh-user-onboarding.spec.ts`, so a clean clone always works on the documented path.

### Verifying the install

The same checks the CI runs are available as standalone scripts:

```bash
bash scripts/setup-check.sh         # Node version, scripts, env, db health
bash scripts/check-better-sqlite3.sh # node -e "require('better-sqlite3')"
pnpm typecheck                       # npx tsc --noEmit -p frontend/tsconfig.json
pnpm lint                            # npx eslint . --ext .ts,.tsx
pnpm test                            # bash run-test-batches.sh
```

A green output from every command above means the operator environment is identical to CI.

---

## What It Does

Think of it as a CRM for nonprofit grants — custom-built for Hacker Dojo:

| Feature         | What you can do                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Discovery**   | Search for grant opportunities from configured funding sources                                        |
| **Pipeline**    | Track every grant through its lifecycle: Matched → Draft → Review → Submitted → Awarded               |
| **AI Drafting** | Generate grant proposals grounded in your organization's profile and documents (requires OpenCode)    |
| **Sources**     | Manage funding sources — add websites, APIs, databases; schedule crawls; approve AI-suggested sources |
| **Tasks**       | Track action items with responsibility tags (finance, program, review, follow-up)                     |
| **Documents**   | Upload and organize supporting materials, letters, compliance docs                                    |
| **Submission**  | Package grant materials with manifests, track submission methods, and manage follow-ups               |
| **Audit Log**   | Every change is recorded — know who did what and when                                                 |
| **Settings**    | Configure organization profile, matching policies, themes and strategic priorities                    |

## How Data Works

All data is stored locally in `.grant-ops-data/`:

- `grant-ops.sqlite` — SQLite database with all grants, sources, tasks, documents, settings
- `documents/` — uploaded files (PDFs, Word docs, etc.)

**Backup your data** by copying the `.grant-ops-data/` folder. To restore, copy it back to the same location.

The app includes a built-in backup/restore system accessible from the Settings view.

## Architecture

- **Frontend:** Next.js 16 with React, Custom CSS (design tokens) — no Tailwind
- **Backend:** Next.js API routes (no separate server needed)
- **Database:** SQLite via better-sqlite3 (embedded, zero-config)
- **AI Agent:** OpenCode CLI for grant research and proposal drafting
- **Testing:** Vitest (unit/integration), Playwright (E2E)

## Engineering Guides

- [`AGENTS.md`](./AGENTS.md) — repo-wide engineering rules and constraints
- [`docs/react-next-style-guide.md`](./docs/react-next-style-guide.md) — strict frontend code style guide for React + Next.js work

## Common Commands

| Command                                | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `pnpm dev` / `npm run dev`             | Start development server                   |
| `pnpm build` / `npm run build`         | Build for production                       |
| `pnpm start` / `npm run start`         | Run production build                       |
| `pnpm test` / `npm test`               | Run unit/integration tests                 |
| `pnpm test:e2e` / `npm run test:e2e`   | Run end-to-end tests (requires Playwright) |
| `pnpm lint` / `npm run lint`           | Check code style                           |
| `pnpm typecheck` / `npm run typecheck` | Type-check the codebase                    |
| `bash scripts/setup-check.sh`          | Verify your environment is ready           |

## Configuring OpenCode

OpenCode is the AI agent that powers research and drafting. To set it up:

1. Install OpenCode CLI from [opencode.ai](https://opencode.ai)
2. Verify it works: `opencode --version`
3. In the app, go to **Settings → OpenCode** and confirm it's detected
4. Configure your API keys in OpenCode's own settings

The app auto-detects OpenCode if it's on your PATH. No manual configuration needed.

---

Built for Hacker Dojo. Local-first. No cloud dependencies. Your data stays yours.
