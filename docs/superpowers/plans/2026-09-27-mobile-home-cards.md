# Mobile Home Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. The owner approved the design and requested Luna implementation with Astra review.

**Goal:** Allow staff to manage bilingual cards shown above the mobile home greeting.
**Architecture:** Dedicated MobileHomeCard Prisma model, org-experience handlers and audience controllers; dashboard settings UI and mobile public-query carousel consume a fixed contract.
**Tech Stack:** NestJS/Prisma, Next.js/TanStack Query, Expo/React Native.
**Spec:** `docs/superpowers/specs/2026-09-27-mobile-home-cards-design.md`

## Global Constraints
- Work only in `/Users/tariq/.codex/worktrees/clinic-catalog-unification/sawaa`, baseline `0647f6273`.
- During implementation, no commit was authorized. The owner later explicitly requested a local commit. No push, merge, deployment, production writes, old migration edits, auth changes, or payment changes.
- Read root AGENTS.md and affected app CLAUDE.md. Preserve others' work. No child agents.
- Staff read/update Setting permissions are reused without changing policy.
- Public images must be File.visibility PUBLIC, not deleted, and image MIME; validate writes and filter again on reads. Never expose private-file signed URLs.
- Image removal is null. English falls back to Arabic. No external URLs or arbitrary routes.
- Workers run only explicitly scoped new tests for red/green; coordinator runs integrated checks/build/types/OpenAPI/smoke.

## Shared Contract
All paths below are beneath the existing API version prefix. Existing response interceptor/wrapping conventions apply.

```ts
type Destination = 'CLINICS' | 'SERVICES' | 'SPECIALISTS' | 'PACKAGES' | 'PROGRAMS';
type CardContent = {
 titleAr: string; titleEn: string | null;
 descriptionAr: string | null; descriptionEn: string | null;
 imageFileId: string | null; imageAltAr: string | null; imageAltEn: string | null;
 destination: Destination | null;
};
type AdminCard = CardContent & {
 id: string; imageUrl: string | null; sortOrder: number; isPublished: boolean;
 createdAt: string; updatedAt: string;
};
type PublicCard = Omit<CardContent, 'imageFileId'> & { id: string; imageUrl: string | null };
// GET /dashboard/mobile-home-cards -> AdminCard[]
// POST /dashboard/mobile-home-cards -> AdminCard; body content, optional sortOrder and isPublished
// PATCH /dashboard/mobile-home-cards/:id -> AdminCard; partial content/publication plus required expectedUpdatedAt ISO string
// PUT /dashboard/mobile-home-cards/reorder -> AdminCard[]
// body { items: Array<{id: string; expectedUpdatedAt: string}> }; full list ordered, duplicates/unknown ids rejected
// GET /public/mobile-home-cards -> PublicCard[]; published only, sortOrder then id
```
Title Arabic trimmed/nonblank/max100; English optional/max100; descriptions max240; image alts max240. Require Arabic alt when attaching an image (a conservative accessible default). Blank optional text becomes null. Optional updates preserve omitted fields; explicit null clears nullable fields only. Reject null required title/publication/order/version. Draft default, safe integer nonnegative order. HTTP409 for stale updates/order; atomic full reorder, detects concurrent insertion/removal and edits, with conditional writes and transaction conflict mapped to409. Do not persist signed URLs.

## Review Focus
1. Private/deleted images must never gain public signed URLs; test write rejection and read filtering.
2. Concurrent reorder must not leave partial state; test stale version and duplicate/missing IDs.
3. Mobile image/network failure preserves text/cached content, and empty cards collapse without a gap.
4. Destination routing supports guests as well as signed-in clients; no raw path from content.
5. Dashboard read-only settings access cannot mutate; failed saves retain edits and conflict explains reload.

### Task 1: Backend (Luna high)
**Owned:** `apps/backend/prisma/schema/organization.prisma`, new additive migration, `src/modules/org-experience/mobile-home-cards/**`, org-experience module registration, new dashboard/public mobile-home-cards controllers and API module registration, focused colocated tests. Only backend source/schema; generated snapshot is coordinator-owned.
- [x] Write focused validation/handler/controller tests for published filtering, guard metadata, invalid inputs, image policy, stale update and atomic reorder.
- [x] Run only these focused tests to establish red; generate local Prisma client if necessary (no DB mutation).
- [x] Implement dedicated model/enum and migration; handlers each expose one execute method; response DTOs document exact shared contract.
- [x] Run only these focused tests green; report any untested transaction assumptions.
Acceptance: contract complete, additive SQL reviewed, no protected-code changes, no policy expansion.

### Task 2: Dashboard (Luna high)
**Owned:** `apps/dashboard/app/(dashboard)/settings/page.tsx`, new `components/features/settings/mobile-home-cards*.tsx`, `lib/api/mobile-home-cards.ts`, `hooks/use-mobile-home-cards.ts`, `lib/types/mobile-home-cards.ts`, AR/EN settings translations, focused dashboard tests. Do not edit generated API types.
- [x] Read dashboard conventions and existing file upload/API/permission hooks.
- [x] Write focused tests for payloads/version propagation, order swap, image upload PUBLIC, null clearing and permission states.
- [x] Run only new focused tests red.
- [x] Implement settings tab, ordered preview list, editor, public-image upload/remove, draft/publish, up/down atomic reorder. Reuse existing media upload API; label image publicity. Disable writes without update Setting. Explain 409 reload and retain unsaved fields on network errors.
- [x] Run only focused tests green and report.
Acceptance: complete bilingual admin flow using shared contract, no business logic in page, no external URL destination input.

### Task 3: Mobile (Luna high)
**Owned:** `apps/mobile/services/mobile-home-cards.ts`, `hooks/useMobileHomeCards.ts`, `components/features/home/HomeCardsCarousel.tsx`, `app/(client)/(tabs)/home.tsx`, required AR/EN translation entries and focused tests within mobile.
- [x] Read mobile conventions, home, LocalizedHorizontalScroll and Glass and existing route definitions.
- [x] Write focused tests for empty, single/multiple, English fallback, locale direction, image failure, destination/no destination, refresh integration.
- [x] Run only new focused tests red.
- [x] Implement public service/query/carousel after HomeTopBar before greeting, same Glass, optional image with contain resize and text no truncation under font scaling, horizontal manual scroll and next-card peek, safe internal destination map for guest/client, no empty gap, cached data on query errors.
- [x] Run only focused tests green and report.
Acceptance: both shared-home entrypoints render cards, public endpoint usable before login, refresh includes cards, no autoscroll or raw content navigation.

### Task 4: Astra review and integration
- [x] Review actual complete diff against spec and contracts; send code fixes back to Luna.
- [x] Generate Prisma, backend build, OpenAPI export from this branch and dashboard generation; inspect generated paths and types.
- [x] Run focused suites, mobile and dashboard typechecks, translation parity and dashboard smoke. Diagnose 429 without changing auth/throttling source; use the existing THROTTLER_DISABLED flag only for isolated local smoke, then restore normal startup.
- [x] Exercise local admin create/publish/reorder/hide and simulator view when runtime available, and report exact remaining gates.
- [x] Keep changes uncommitted through implementation, then update spec/plan status and evidence. The owner subsequently requested a local commit.

## Execution result
Implemented by three GPT-6 Luna high workers and reviewed/integrated by Astra. See [verification evidence and remaining visual gates](2026-09-27-mobile-home-cards-verification.md). The owner subsequently requested a local commit. Runtime smoke used the existing local test throttle flag after reproducing 429; it has been removed from the running API process. No production/staging operation occurred.
