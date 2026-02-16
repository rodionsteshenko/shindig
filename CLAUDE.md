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

## Conventions

- Import paths use the `@/*` alias mapping to `src/*`
- Brand color: `shindig-{50..900}` (purple palette defined in `tailwind.config.ts`)
- Mobile-first responsive design with Tailwind breakpoints (`md:`, `lg:`)
- Database schema and planned API endpoints are documented in `FEATURES.md`
- Environment variables are listed in `.env.local.example` — Supabase keys are prefixed `NEXT_PUBLIC_` for client-side access
