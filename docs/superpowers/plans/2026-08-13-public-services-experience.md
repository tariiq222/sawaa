# Public Services Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer-facing clinics discovery surfaces with real bookable services and preserve `/clinics` as a permanent redirect.

**Architecture:** Add one pure catalog selector that intersects public services with the clinics department and bookable employee assignments. Feed its result into a shared service-card component used by a home carousel and a full `/services` grid, while keeping `/booking` responsible for therapist and slot selection.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, Lucide React.

**Spec:** `docs/superpowers/specs/2026-08-13-public-services-experience-design.md`

## Global Constraints

- Preserve the existing dirty `apps/website/app/layout.tsx` change and the unrelated untracked legacy-import spec.
- Do not commit, push, deploy, alter production data, or modify backend contracts.
- Preserve the established Sawaa design tokens and responsive/accessible interaction conventions.
- Respect `showPrice` and `showDuration`; never render unbookable services.
- Keep support groups and bundles off the individual-services surfaces.

---

### Task 1: Derive bookable service cards

**Files:**
- Create: `apps/website/features/public-catalog/bookable-services.ts`
- Create: `apps/website/features/public-catalog/bookable-services.test.ts`
- Modify: `apps/website/features/public-catalog/types.ts`
- Modify: `apps/website/features/public-catalog/public.ts`

**Interfaces:**
- Consumes: `PublicCatalog`, `PublicEmployee[]`, and locale-independent catalog IDs.
- Produces: `selectBookableClinicServices(catalog, employees): BookableService[]`, where each item contains the service, localized category fields, delivery types, and `practitionerCount`.

- [x] **Step 1: Write the failing selector tests**

Cover literal fixtures for: including a service assigned to a bookable employee, excluding unassigned services, excluding services from groups/bundles, and counting unique bookable practitioners.

- [x] **Step 2: Run the selector test and verify RED**

Run: `pnpm --filter=@sawaa/website test -- features/public-catalog/bookable-services.test.ts`

Expected: FAIL because `selectBookableClinicServices` does not exist.

- [x] **Step 3: Implement the minimal selector and complete public catalog types**

Add public duration-option and booking-config shapes. Locate the clinics department through `findDepartment`, map its categories, intersect services with bookable `serviceIds`, and derive unique delivery types plus practitioner count.

- [x] **Step 4: Run the selector test and verify GREEN**

Run the same focused command and expect all selector cases to pass.

### Task 2: Build reusable service cards and the home section

**Files:**
- Create: `apps/website/themes/sawaa/components/services/service-card.tsx`
- Create: `apps/website/themes/sawaa/components/sections/services.tsx`
- Create: `apps/website/themes/sawaa/components/sections/services.test.tsx`
- Modify: `apps/website/themes/sawaa/pages/home.tsx`
- Modify: `apps/website/features/site-content/section-intros.ts`
- Modify: `apps/website/features/site-content/site-content.i18n.test.ts`
- Modify: `apps/website/features/locale/dictionary.ts`

**Interfaces:**
- Consumes: `BookableService[]`, `vatRate`, localized `SectionIntro`, and `services.*` dictionary keys.
- Produces: accessible service cards linked to `/booking?serviceId=...` and a home carousel linked to `/services`.

- [x] **Step 1: Write failing component and translation tests**

Assert a real card exposes the service name, respects hidden price/duration, displays practitioner availability, links to the exact service deep link, and that Arabic/English intros use services language.

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter=@sawaa/website test -- themes/sawaa/components/sections/services.test.tsx features/site-content/site-content.i18n.test.ts`

Expected: FAIL because the services component and copy do not exist.

- [x] **Step 3: Implement minimal cards, carousel, copy, and home wiring**

Reuse Sawaa tokens, remove decorative numbering, add the facts rail, preserve keyboard focus, and replace the home clinics selector/component with `selectBookableClinicServices` plus `Services`.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the same focused test command and expect all cases to pass.

### Task 3: Add the services page and replace customer-facing clinic routes

**Files:**
- Create: `apps/website/themes/sawaa/pages/services.tsx`
- Create: `apps/website/themes/sawaa/components/services/services-directory.tsx`
- Create: `apps/website/app/services/page.tsx`
- Modify: `apps/website/app/clinics/page.tsx`
- Modify: `apps/website/themes/types.ts`
- Modify: `apps/website/themes/registry.ts`
- Modify: `apps/website/themes/sawaa/components/layout/navbar.tsx`
- Modify: `apps/website/themes/sawaa/layout/layout.tsx`
- Modify: `apps/website/themes/sawaa/components/layout/footer.tsx`

**Interfaces:**
- Consumes: the selector and shared service card from Tasks 1–2.
- Produces: `/services`, permanent `/clinics` redirect, services navigation, and linked footer services.

- [x] **Step 1: Update the navbar test with the failing services-link contract**

Add this behavior assertion to `navbar.test.tsx` before changing the navbar:

```tsx
it('links customers to the services directory instead of clinics', () => {
  render(wrap('ar', <Navbar />));
  expect(screen.getByRole('menuitem', { name: 'الخدمات' })).toHaveAttribute(
    'href',
    '/services',
  );
});
```

Route compilation and `permanentRedirect('/services')` are verified through the Next production build because the repository has no route-unit harness.

- [x] **Step 2: Run the focused navbar test and verify RED**

Run: `pnpm --filter=@sawaa/website test -- themes/sawaa/components/layout/navbar.test.tsx`

Expected: FAIL on the old `/clinics` contract.

- [x] **Step 3: Implement the route, page, redirect, registry, navbar, and footer**

The services page fetches catalog and employees, applies the same selector, renders a responsive grid, and preserves the same empty-state contract as the home section.

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter=@sawaa/website test -- \
  themes/sawaa/components/layout/navbar.test.tsx \
  themes/sawaa/components/sections/services.test.tsx \
  features/public-catalog/bookable-services.test.ts \
  features/site-content/site-content.i18n.test.ts
```

### Task 4: Verification and requirements audit

**Files:**
- Verify all modified website files and this plan/spec.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: fresh evidence for unit behavior, types, production build, and diff hygiene.

- [x] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter=@sawaa/website test -- \
  themes/sawaa/components/layout/navbar.test.tsx \
  themes/sawaa/components/sections/services.test.tsx \
  features/public-catalog/bookable-services.test.ts \
  features/site-content/site-content.i18n.test.ts
```

- [x] **Step 2: Run website typecheck**

Run: `pnpm --filter=@sawaa/website typecheck`

- [x] **Step 3: Run website production build**

Run: `pnpm --filter=@sawaa/website build`

- [x] **Step 4: Audit the final diff and requirements**

Run `git diff --check`, inspect `git status --short`, confirm the unrelated dirty files are unchanged, and verify every requirement in the approved spec maps to implementation and evidence.
