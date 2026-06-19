---
target: apps/dashboard — practitioner & service edit flows
total_score: 18
p0_count: 3
p1_count: 2
timestamp: 2026-06-18T11-40-18Z
slug: apps-dashboard-practitioner-service-edit-flows
---
# Critique — Practitioner & Service Edit Flows

**Target:** Sawa dashboard — practitioner (employee) and service edit screens.
**Register:** product (admin dashboard).
**Date:** 2026-06-18.
**Method:** static source review of all in-scope files + bundled detector scan + research brief.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Schedule tab on detail is read-only with no Edit affordance; stale data after Sheet save; no rollback on partial-failure save |
| 2 | Match System / Real World | 3 | RTL + tabular-nums + domain vocabulary all correct; useCustomPricing semantics diverge from data model |
| 3 | User Control and Freedom | 2 | Sheet/form cancel exist; no undo; hidden nav to /edit; no rollback on partial save |
| 4 | Consistency and Standards | 1 | **3 different card idioms in one screen family**; SectionHeader/DataTable canonical primitives unused here; two parallel edit surfaces for the same data |
| 5 | Error Prevention | 2 | useCustomPricing toggles all typeConfigs blindly; no inline validation; partial-save possible |
| 6 | Recognition Rather Than Recall | 2 | Default price in placeholder (vanishes on focus); 7 day cards with no summary; hidden Edit affordance on schedule |
| 7 | Flexibility and Efficiency of Use | 2 | No inline edit; no bulk actions; no keyboard shortcuts; three divergent paths for one task |
| 8 | Aesthetic and Minimalist Design | 2 | 3 card idioms = visual noise; 5 tabs + sticky submit on service form; 6 tabs on employee detail — "many cards" complaint |
| 9 | Error Recovery | 1 | Partial-save silently fails; no refetch after Sheet save; no error shown; no draft autosave |
| 10 | Help and Documentation | 1 | No inline help/tooltips; vacation greys out schedule without explanation; default price hint buried in placeholder |
| **Total** | | **18/40** | **Poor — major UX overhaul required; core editing flow is fragile** |

---

## Anti-Patterns Verdict

**LLM assessment:** this does not look AI-generated. The codebase uses tokens correctly, no hex codes, no glass misuse, no gradient text, no eyebrows. The aesthetic is restrained and on-brand. The product-register bar ("earned familiarity, tool disappears into the task") is partially met: vocabulary is consistent in *types* but not in *cards*.

**Deterministic scan:** detector returned `0` findings on the in-scope source files (`components/features/employees`, `components/features/services`, `app/(dashboard)/employees`, `app/(dashboard)/services`). The findings on the whole dashboard were all in `coverage/` (test report HTML), not real source. Confirms: no AI slop — issues are functional UX, accessibility, and consistency.

**Visual overlays:** not injected. The CLI detector is the evidence layer for this run (no running dev server in the current session; static analysis is sufficient for a critique brief).

---

## Overall Impression

Functionally rich, visually noisy, and operationally fragile. When a receptionist opens a practitioner to change a single price, they navigate through 4–6 sections/tabs/cards; the same data can be edited from 3 different places with 3 different save paths; the schedule is read-only on the detail page with no clear way to edit; saves can partially fail without rollback; and parent lists don't refresh after inline edits. The visual vocabulary has drifted into 3 hand-rolled card idioms that the user reads as "too many cards." Token discipline is solid; the design system is healthy; the screen-level composition and interaction model need a focused pass.

---

## What's Working

1. **Token discipline** — zero hex, zero `text-gray-*`, no glass misuse, shadcn primitives used correctly. The color/typography foundation is sound.
2. **RTL/i18n handling** — logical `ps-`/`pe-`/`ms-`/`me-` throughout; `tabular-nums` on numeric inputs; halala ↔ SAR conversion handled cleanly; per-locale `useLocale()` (not next-intl) wired properly.
3. **Data model** — the underlying schema supports per-type pricing/duration overrides, per-employee service assignment, and a real schedule with breaks + vacations + a 2nd window. The model is solid; the UI just doesn't expose it elegantly.

---

## Priority Issues

### P0 — Hidden affordance: schedule tab on detail is read-only, with no path to edit
- **What:** `components/features/employees/employee-profile-sections.tsx:35-83` (`EmployeeAvailabilitySection`) renders a 2-col grid of working hours with no Edit button. The only way to edit schedule is to navigate to `/employees/{id}/edit`, which is invisible from the detail page.
- **Why it matters:** users see a working-hours grid and reasonably assume it's editable. When nothing happens, they think the schedule is broken or that they lack permission. The hidden nav step is a support ticket waiting to happen.
- **Fix:** add an "Edit schedule" button in the section header that opens the existing `schedule-tab.tsx` editor inline (drawer/sheet) or navigates with a clear affordance. Resolve dead code first (`schedule-editor.tsx` — 227 lines, unused).
- **Suggested command:** `/impeccable shape apps/dashboard/employees/[id] — schedule inline edit`

### P0 — Inconsistent card vocabulary: 3 different "card" idioms in one screen family
- **What:** three hand-rolled row/card classes coexist in the same flow:
  - `<div className="rounded-md border border-border bg-muted/30 p-3">` — `employee-services-section.tsx:145`
  - `<div className="rounded-xl border border-border bg-surface px-4 py-3">` — `service-employees-tab.tsx:121, 206`
  - `<div className="rounded-lg border border-dashed border-border p-3">` — `edit-employee-service-sheet.tsx:216`, `service-availability-windows-editor.tsx:43`, `employee-service-types-editor.tsx:85`
  - shadcn `Card` is used elsewhere on the same screens (`pricing-tab.tsx:73`, `schedule-tab.tsx:115`).
- **Why it matters:** the user can't build a stable mental model of "what a service row looks like." The visual noise is exactly the "many cards" the user complained about. Per dashboard `CLAUDE.md` design principles, the codebase should avoid identical-card grids *and* ad-hoc visual idioms.
- **Fix:** define one token (e.g. `surface-row` in `lib/ds.ts` or a Tailwind component class) and replace the 3 hand-rolled variants. Use the same token for dashed-border sub-rows with a `variant="dashed"` modifier.
- **Suggested command:** `/impeccable distill apps/dashboard — practitioner/service card vocabulary`

### P0 — Save flow has 3 entry points for the same data with 3 different behaviors
- **What:** the same per-practitioner price/duration override can be edited from:
  1. `EditEmployeeServiceSheet` from employee detail (`edit-employee-service-sheet.tsx:143-171`) — two serial mutations.
  2. `AddServiceForm` inline in employee edit page (`create/services-tab.tsx:165-193`) — saves on parent form submit.
  3. `EditEmployeeServiceSheet` from service detail (`service-employees-tab.tsx:271-276`) — same Sheet as #1, but no `invalidateQueries` after save.
- **Why it matters:** a single change has 3 different save paths, 3 different loading states, 3 different error surfaces, and 3 different stale-data behaviors. Users will pick the "wrong" path and find inconsistent behavior. The bulk `useCustomPricing` toggle applies `useCustomOptions: true` to *every* typeConfig at once (`edit-employee-service-sheet.tsx:127-135`), which is surprising and unsaveable as a per-type intent.
- **Fix:** pick one canonical editor (the Sheet is the better of the two); retire `AddServiceForm`'s inline editing variant; move `useCustomOptions` to per-row toggles inside `EmployeeTypeRow` and `BookingTypeRow` (the data model already supports it).
- **Suggested command:** `/impeccable distill apps/dashboard — practitioner service edit surface`

### P1 — Stale data after inline edit; partial-failure state possible
- **What:**
  - `service-employees-tab.tsx:270` carries a stale-data comment and lacks `invalidateQueries` after the Sheet closes — the parent list shows the old price.
  - `edit-employee-service-sheet.tsx:147-162` fires two mutations in series: `updateMut.mutateAsync` then `optionsMut.mutateAsync`. If the second fails, `isActive` is already persisted, no rollback fires, no error is shown.
- **Why it matters:** users edit a price, the Sheet closes, the row still shows the old price — they think the save failed and try again, double-saving. Or they edit isActive, the second mutation fails silently, and the service stays active in the system while appearing inactive to the user.
- **Fix:** collapse to a single mutation that takes the full payload (`isActive` + `bufferMinutes` + `typeConfigs[]`); add `queryClient.invalidateQueries` on success; show a single error toast on failure.
- **Suggested command:** `/impeccable harden apps/dashboard — practitioner service save flow`

### P1 — No inline edit for small mutations; "open Sheet → edit one number → Save" is the only path
- **What:** `edit-employee-service-sheet.tsx:253-269` — to change buffer minutes (a single number) or toggle isActive, the user must open a side sheet, scroll to the field, save, close. The same is true for the `isActive` toggle.
- **Why it matters:** this is the "many cards / complex process" pain the user described. For a receptionist updating 20 practitioners' buffer by ±5 minutes, this is 80+ clicks. A row click + inline popover + Cmd+Enter would be 20 clicks.
- **Fix:** add an inline-edit affordance: popover on price/buffer fields (click → number input → save on Enter or blur), inline toggle for isActive (no Sheet, just `Switch` in the row with optimistic update).
- **Suggested command:** `/impeccable shape apps/dashboard/employees/[id] — inline edit affordances`

---

## Persona Red Flags

**Alex (Power User):**
- No keyboard shortcuts for save / next row / bulk-edit.
- No bulk actions (e.g. "set buffer = 10 min for all selected practitioners").
- One-item-at-a-time workflow: open Sheet → edit → Save → close. For 20 rows = 80+ clicks.
- 5–6 tabs per page with no keyboard nav visible.
- Form-level submit at bottom regardless of active tab — feels decoupled from where the user is editing.
- **Verdict:** high abandonment risk for bulk operations; will hit the back button and use the spreadsheet export if one exists.

**Sam (Accessibility-Dependent):**
- Tabs (6 on detail, 3–5 on edit) — Radix tabs support arrow keys, but the 3+ sheet flows and the bulk `useCustomPricing` toggle are not announced.
- `useCustomPricing` Switch changes all typeConfigs — a screen reader user has no warning that a single switch affects multiple rows.
- `Input type="number"` is locale-unaware — Arabic-Indic digits break; SR users get the wrong number announced.
- Schedule tab on detail is read-only with no Edit button — no SR announcement that the section is non-editable; the user assumes the input is broken.
- `formatPrice(Number(st.price))` called without locale (`employee-services-section.tsx:237, 257, 259, 261`) — `t("employees.services.sar")` separator and `formatPrice` separator may diverge.
- **Verdict:** several real SR breaks; needs an a11y pass before sign-off.

**Riley (Stress Tester):**
- 7 day cards × multiple breaks + 2nd-window inputs — what happens with 5 breaks in one day? Layout? Overflow? Persistence?
- `grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_auto_2rem]` with no `overflow-x-auto` — at `sm` viewport (640px) the fixed 7rem + 2rem columns push the two `1fr` inputs into a tiny strip.
- Two-mutation save: open Sheet → edit isActive → save → server saves isActive → options mutation fails → isActive persisted, options reverted. **No error shown.** Workflow appears to work, produces wrong results.
- Refetch missing: edit price → close Sheet → parent row shows old price → user retries → double-save.
- Vacation toggle → `opacity-40 pointer-events-none` on schedule Card — no copy explains "Schedule suspended while on vacation."
- **Verdict:** silent partial-save + missing refetch = "appears to work but produces wrong results" failure mode.

---

## Minor Observations

- `SectionHeader` (`components/features/section-header.tsx`) is the canonical section header used in 5 other feature forms; **not** used in any employees/services edit screen. `employee-services-section.tsx:66` rolls its own `<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">` — ad-hoc eyebrow.
- `DataTable` is the canonical list primitive; **not** used on edit screens.
- `ArrowRight01Icon` used as RTL-agnostic "view" indicator in `service-employees-tab.tsx:261` — should be locale-aware or replaced with `ArrowLeft01Icon` under `isAr`.
- `formatPrice(Number(...))` called without locale in `employee-services-section.tsx:237, 257, 259, 261`.
- Default price shown as placeholder (`employee-type-row.tsx:43-48`) and duplicated as a hint below the label (`employee-type-row.tsx:127-132`) — two sources of the same info; placeholder vanishes on focus.
- Dead code: `components/features/employees/schedule-editor.tsx` (227 lines) + `schedule-editor.types.ts` not imported anywhere except their own unit test.
- `AddServiceForm` (`create/services-tab.tsx:165-193`) duplicates the Sheet's editing logic.
- `service-form-page.tsx` at 334 lines exceeds the 150-line cap (has `EXCEPTION` comment dated 2026-04-24).
- `employee-form-page.tsx:80` carries `as never` type assertion on the zodResolver — technical debt.
- Vacation `opacity-40` greys out schedule Card without explicit user-facing copy on the schedule Card itself (`schedule-tab.tsx:116-127`).
- i18n pre-PR gate `npm run i18n:verify` is mandatory per `apps/dashboard/CLAUDE.md`; any label change must clear it.
- Dashboard smoke e2e gate per `AGENTS.md` security tiers (Medium): `pnpm --filter=dashboard run e2e:smoke` should pass after any visual change here.

---

## Questions to Consider

- What if there were one canonical "Edit practitioner service" Sheet used everywhere, with inline expand for small tweaks (buffer, isActive)?
- What if the schedule editing lived on the detail page (inline per-day cards), with the /edit page reserved for bulk / create flows?
- What if `useCustomOptions` were per-type inside `EmployeeTypeRow` (matching the data model) instead of a bulk toggle?
- What if the card vocabulary were unified to a single `surface-row` token, cutting the visual noise floor by 60%?
- What if a power-user path existed: Cmd+Click to select rows, Cmd+E to bulk-edit, Cmd+S to save inside an inline editor?
- What if saves were optimistic with rollback on failure (so the row updates instantly and reverts on error)?

---

## Recommended Next Actions (user chose: critique only)

1. **`/impeccable distill apps/dashboard — practitioner/service card vocabulary`** — unify 3 card idioms into 1 token; retire 2 hand-rolled divs; replace ad-hoc `h4 uppercase` with `SectionHeader`.
2. **`/impeccable harden apps/dashboard — practitioner service save flow`** — collapse 2-mutation save to 1, add `invalidateQueries`, add error toast, fix partial-failure state.
3. **`/impeccable shape apps/dashboard/employees/[id] — schedule inline edit`** — plan inline edit for schedule on detail page; resolve dead `schedule-editor.tsx`.
4. **`/impeccable adapt apps/dashboard — EmployeeTypeRow responsive`** — fix 7rem grid column overflow at sm viewport with `overflow-x-auto` or stacked layout.
5. **`/impeccable polish apps/dashboard — practitioner/service edit flows`** — final pass after the above four land.

After fixes, re-run `/impeccable critique` on the same slug to track the score.
