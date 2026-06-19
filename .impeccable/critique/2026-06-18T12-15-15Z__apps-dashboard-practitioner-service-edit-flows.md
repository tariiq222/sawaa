---
target: apps/dashboard — practitioner & service edit flows (post-fix delta)
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-06-18T12-15-15Z
slug: apps-dashboard-practitioner-service-edit-flows
---
# Critique — Practitioner & Service Edit Flows (post-fix delta)

**Target:** Sawa dashboard — practitioner (employee) and service edit screens.
**Register:** product (admin dashboard).
**Date:** 2026-06-18 (this is the post-fix follow-up; see the earlier snapshot `2026-06-18T11-40-18Z` for the original baseline of 18/40).
**Method:** static source review of the post-fix working tree; tracker of what the previous round's P0/P1 issues became.

## Score delta

| Issue | Before | After | Notes |
|---|---|---|---|
| P0 #1 hidden schedule edit affordance | 0 | ✅ fixed | `Edit schedule` button in `EmployeeAvailabilitySection` `CardAction` slot, navigates to `/employees/{id}/edit`. i18n key `employees.detail.editSchedule` added in AR + EN. |
| P0 #2 3 hand-rolled card idioms | 0 | ✅ fixed | New `@sawaa/ui` primitive `SurfaceRow` (variant: default / muted / dashed, size: sm / md). 5 dashboard files migrated. The `default` variant uses `bg-card` (the canonical surface), matching `Card`. |
| P0 #3 three divergent save paths | partial | partial | The global `useCustomPricing` Switch in the Sheet is removed; per-row `useCustomOptions` in `EmployeeTypeRow` is the only path. **But** the parallel `AddServiceForm` editor (in `create/services-tab.tsx`) still exists and is a divergent surface for the same data. Deferred — bigger refactor, separate task. |
| P1 stale data after Sheet save | ❌ | ✅ fixed | `useEmployeeServiceMutations` now invalidates `queryKeys.services.employees(vars.serviceId)` in both `updateMut.onSuccess` and `optionsMut.onSuccess` in addition to the existing `queryKeys.employees.services(employeeId)` invalidation. |
| P1 partial-failure silent | ❌ | ✅ fixed | Sheet's `onSubmit` error path now uses `t("employees.services.updateError")` (new AR + EN key) and `console.error(err)` for debug. Sheet stays open on error. |
| P1 `EmployeeTypeRow` responsive grid | ❌ | ✅ fixed | Wrapper `overflow-hidden` → `overflow-x-auto`; inner grid gets `min-w-[640px]`. Below 640px the table scrolls horizontally instead of clipping. |
| P1 `useCustomPricing` bulk toggle | ❌ | ✅ fixed | Removed from the Sheet. `buildEmployeeServiceOptionsPayload` now iterates `typeConfigs` per-row using each row's own `useCustomOptions` field. 5 files touched, 1215/1215 unit tests pass. i18n keys for the removed UI are kept (still referenced by `assign-service-sheet.tsx` and `add-service-form.tsx`). |

## Issues deferred to a follow-up pass

1. **Inline edit for small mutations** (P1 from baseline) — the underlying P1 "buffer minutes / isActive via Sheet only" is still unaddressed. A popover / expand-in-place affordance is the next-best step.
2. **`AddServiceForm` and `assign-service-sheet.tsx` divergence** — they still have a global `useCustomPricing` Switch. Same per-row refactor as the Sheet; not done because out-of-scope for the P0 fix. Removing the now-referenced i18n keys requires finishing these two callers first.
3. **Dead code `schedule-editor.tsx` + `schedule-editor.types.ts`** — 227 lines unused. Retire in a separate cleanup.
4. **Pre-existing `category-form-page.tsx:58` Zod v3/v4 resolver error** — unrelated to this work, lives on `main`. Flagged for separate fix.
5. **Schedule → /edit nav doesn't honor `?tab=schedule`** — the edit page uses uncontrolled `<Tabs defaultValue="basic">` and doesn't read a tab query param. User lands on the basic tab and must click "Schedule" to reach the editor. Could be added later.

## Verification matrix (post-fix)

| Check | Result |
|---|---|
| `pnpm --filter=@sawaa/ui typecheck` | ✅ exit 0 |
| `pnpm --filter=dashboard typecheck` | ❌ only `category-form-page.tsx:58` (pre-existing on `main`, Zod v3/v4 resolver) |
| `pnpm --filter=dashboard lint` | ✅ 0 errors, 1 pre-existing warning in `service-form-page.tsx:189` |
| `pnpm --filter=dashboard i18n:verify` | ✅ `[parity] OK — ar/en files have matching key sets` |
| `pnpm --filter=dashboard test` (Vitest) | ✅ 1215/1215 pass across 149 files |

## Net diff

20 files changed, +125 / -121 lines.

```
apps/dashboard/components/features/employees/assign-service-sheet.tsx          |   2 +-
apps/dashboard/components/features/employees/edit-employee-service-sheet.tsx |  65 ++++------------------
apps/dashboard/components/features/employees/employee-profile-sections.tsx    |  16 +++++-
apps/dashboard/components/features/employees/employee-service-option-overrides.ts |  34 +++--------
apps/dashboard/components/features/employees/employee-service-types-editor.tsx |  13 +++--
apps/dashboard/components/features/employees/employee-services-section.tsx    |   5 +-
apps/dashboard/components/features/employees/use-employee-form.ts            |   8 +--
apps/dashboard/components/features/services/service-availability-windows-editor.tsx |   6 +-
apps/dashboard/components/features/services/service-employees-tab.tsx         |  17 ++++--
apps/dashboard/hooks/use-employee-mutations.ts                                |  10 +++-
apps/dashboard/lib/translations/{ar,en}.{employees,ops,services}.ts          |  24 +++++
apps/dashboard/test/unit/features/employees/employee-service-option-overrides.spec.ts |  32 ++++++++---
packages/ui/src/index.ts                                                      |   1 +
packages/ui/src/primitives/surface-row.tsx (NEW)                              |  36 +++++++++++++
```

## Estimated re-score

The earlier baseline was 18/40. The P0 issues that drove the score down (#1, #2, #3-partial, the bulk toggle) are all addressed or partially addressed. The deferred items (inline edit, `AddServiceForm` divergence, dead code) are still P1/P2. Re-running `/impeccable critique` on this slug should land the score in the 24-28 / 40 range (Acceptable → Good). Run a fresh critique to capture the new score in the trend.
