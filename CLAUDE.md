# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint via Next.js
npm test             # Run all Playwright E2E tests
npm run test:headed  # Run E2E tests with visible browser
npm run test:ui      # Run E2E tests with Playwright UI
npm run pipeline     # Run full feature pipeline (judge → PRD → Ralph)
npm run setup-github # Create GitHub labels and milestones (idempotent)
```

## Testing

**Framework:** Playwright E2E tests in `e2e/` directory.

**Test convention:** One spec file per feature area:
- `e2e/landing.spec.ts` — Landing page content and links
- `e2e/header.spec.ts` — Navigation bar, auth state display
- `e2e/login.spec.ts` — Login page rendering, redirect behavior
- `e2e/event-creation.spec.ts` — Auth gating, form rendering, event submission
- `e2e/public-event.spec.ts` — Public event page content, cover, gifts, calendar
- `e2e/rsvp.spec.ts` — RSVP page rendering, form interactions, API CRUD
- `e2e/api-events.spec.ts` — Event API routes (public reads, auth guards)
- `e2e/api-guests.spec.ts` — Guest management API auth guards
- `e2e/api-invite.spec.ts` — Invitation/reminder API auth guards

**Test helpers** (`e2e/helpers.ts`):
- `ensureTestUser()` — Creates/finds a test user in Supabase Auth
- `loginAsTestUser(page)` — Sets auth cookies on a Playwright page
- `seedEvent(hostId, overrides?)` — Inserts a test event via admin client
- `seedGuest(eventId, overrides?)` — Inserts a test guest via admin client
- `cleanupTestData()` — Removes test data after tests complete

**Rules:**
- **All E2E tests must pass before moving to a new implementation phase**
- When adding a new feature, write E2E tests for it in the same phase
- Tests use a real Supabase instance (seeded via service role client)
- Auth is handled by setting session cookies directly (no magic link in tests)
- Test data uses `*.shindig.test` emails and `E2E Test*` prefixed titles for easy cleanup

## Tech Stack

- **Next.js 15** (App Router) with **React 19** and **TypeScript** (strict mode)
- **Tailwind CSS 3.4** for styling — utility classes only, no CSS modules
- **Supabase** for database (Postgres), auth, and realtime
- **Resend** for email delivery
- Deployed on **Vercel** (serverless)

## Architecture

**Next.js App Router** with file-based routing in `src/app/`. Server Components are the default; only add `"use client"` when needed.

Key routes:
- `/` — Landing page (implemented)
- `/create` — Event creation
- `/e/[slug]` — Public event page (unauthenticated)
- `/dashboard` — Host dashboard (authenticated)
- `/rsvp/[token]` — RSVP form (unauthenticated, token-based access)
- `/features` — Public feature request board

**API routes** live in `src/app/api/{events,rsvp,features}/` as Next.js Route Handlers.

**RSVP flow** is token-based: each guest gets a unique token link so they can respond without creating an account.

**Feature board** is a core product concept — users suggest and vote on features that shape the roadmap.

## Project Layout

- `src/app/` — Pages and API routes (App Router conventions)
- `src/components/` — Shared React components (PascalCase filenames)
- `src/lib/` — Utility modules and service clients (supabase, resend, etc.)
- `public/themes/` — Event theme assets

## Feature Pipeline (Ralph)

The pipeline automatically triages user-submitted feature requests, generates PRDs, and implements them using [Ralph](https://github.com/anthropics/ralph) (an AI dev agent).

### How it works

1. **Users submit features** via the `/features` board → stored in Supabase `feature_requests` table
2. **Judge** (`scripts/judge-features.ts`) — Claude evaluates each open submission: approved, rejected, or needs_clarification
3. **Generate PRD** (`scripts/generate-prd.ts`) — Claude creates a Ralph-compatible PRD for each approved feature, then creates a **GitHub Issue** with the PRD embedded in a `<details>` block
4. **Pipeline picks next issue** (`scripts/pipeline.ts`) — queries GitHub Issues labeled `pipeline:queued`, parses the PRD from the issue body, writes it to `.ralph/prd.json`, and runs `ralph execute`
5. **On completion** — the issue gets labeled `pipeline:completed` and closed

### What lives where

| Concern | Location |
|---|---|
| User submissions, votes, AI verdicts | Supabase `feature_requests` table |
| Implementation tracking (queued/in-progress/completed) | GitHub Issues + `pipeline:*` labels |
| PRD storage | GitHub Issue body (details block) + Supabase `prd_json` column |
| Roadmap versions | GitHub Milestones (v1.0 MVP, v1.5, v2.0, v3.0) |

### GitHub Labels

- `pipeline:queued` / `pipeline:in-progress` / `pipeline:completed` — implementation state
- `type:feature` / `type:bug` — submission type
- `priority:critical` / `priority:high` / `priority:medium` / `priority:low` — AI severity
- `source:roadmap` / `source:user` — where the feature came from

Run `npm run setup-github` to create all labels and milestones (idempotent).

### Pipeline scripts

```bash
npm run judge           # Evaluate open feature requests with Claude
npm run generate-prd    # Generate PRDs + create GitHub Issues for approved features
npm run trigger-ralph   # Pick next queued issue, output PRD to stdout
npm run pipeline        # Full pipeline: judge → generate-prd → pick issue → ralph execute
npm run seed-roadmap    # Seed feature_requests from FEATURES.md checklist items
npm run setup-github    # Create GitHub labels and milestones (run once)
```

### Cron job

The pipeline runs every 15 minutes via a macOS launchd agent:

- **Plist:** `scripts/com.shindig.pipeline.plist` (Label: `com.shindig.pipeline`)
- **Wrapper:** `scripts/pipeline-wrapper.sh` → runs `npm run pipeline`
- **Logs:** `logs/pipeline-launchd.log`
- **Lock:** `.ralph/pipeline.lock` — prevents concurrent runs (auto-expires after 2 hours)

Each invocation implements **one feature** end-to-end (all user stories in its PRD) before exiting.

### Key files

- `scripts/pipeline.ts` — Orchestrator (judge → generate → pick → execute)
- `scripts/generate-prd.ts` — PRD generation + GitHub Issue creation
- `scripts/trigger-ralph.ts` — Standalone: pick next queued issue and output PRD
- `scripts/judge-features.ts` — AI evaluation of submissions
- `scripts/setup-github-labels.ts` — Label/milestone bootstrap
- `scripts/seed-features-from-roadmap.ts` — Seed from FEATURES.md
- `.ralph/prd.json` — Current PRD being executed by Ralph

## Conventions

- Import paths use the `@/*` alias mapping to `src/*`
- Brand color: `shindig-{50..900}` (purple palette defined in `tailwind.config.ts`)
- Mobile-first responsive design with Tailwind breakpoints (`md:`, `lg:`)
- Database schema and planned API endpoints are documented in `FEATURES.md`
- Environment variables are listed in `.env.local.example` — Supabase keys are prefixed `NEXT_PUBLIC_` for client-side access
