# People, SMS, bookings and shared navigation remediation evidence

Status: implementation and focused checks complete. Integrated OpenAPI, real local acceptance and smoke results are recorded in integrated-validation.md; CI/merge/deployment evidence is tracked separately. No production publication.

| Audit IDs | Resolution / owning source | Focused evidence |
| --- | --- | --- |
| A043 | `update-availability.handler` preserves omitted exceptions, explicit [] clears; `employee-detail-page` uses resolved UUID for all child tabs; form hydrates actual nameEn | RED leave/state regression → 19 backend tests GREEN; employee form 7 tests GREEN |
| A044–A045 | Removed services call remove endpoint; empty windows/breaks submitted, missing weekly windows hydrate inactive | Employee form focused 7 tests |
| A046, A048 | Public profile and activation success/error feedback | Existing error path retained; local rendered verification pending |
| A047 | Backend groupBy full-set score counts, preserved by employee ratings adapter | ListEmployeeRatings 6 tests GREEN |
| A049 | Existing public profile already has file upload endpoint/form, no URL text field. Historical report claim does not apply to current base | `public-profile-tab.tsx`, `uploadEmployeePublicImage` |
| A050 | Leave inclusive end-calendar-day compared in Asia/Riyadh | `employee-profile-sections.tsx`; final rendered check pending |
| A051 | Exposed existing employee activation booking admission gate as isAcceptingBookings (not slot availability); no new policy | employee-row.mapper RED two assertions → 2 GREEN; create-booking already rejects inactive employee |
| A052 | English list/detail/name hydration use actual nameEn | Employee form name regression |
| A023–A025 | Added absent common.create/client-created keys; undefined email proof false; existing-phone return has explicit existing-record toast | Clients API 10 tests GREEN; create rendered check pending |
| A026 | Replaced placeholder invoice/stats panes with real client-scoped paginated invoices and server-wide booking totals | use-client-records 3 tests GREEN, includes later page and error |
| A027 | Detail edit/delete/account actions and invoice/booking panes check their current permissions | client-detail-page 4 tests GREEN |
| A028–A029 | Optional clears sent null, edit errors/not-found disable unavailable form and canonical UUID saves | client API null regression GREEN; live save pending |
| A030–A032 | Whitelisted server sorting with stable ID before pagination; confirm disable/enable; mononym has empty family name | ListClients / CreateClient DTO focused GREEN; schema 17 GREEN |
| A033 | Client create/record/edit use shared breadcrumb component; edit chain includes record parent | shared source + breadcrumb regression suite pending |
| A007–A011 | Complete lifecycle filters, new=1 create gate, all-time descending backend sort, retry copy, client header | booking query RED first request → 8 GREEN, backend sort RED → 30 GREEN, tab UI10 GREEN |
| A129–A133 | Preserve same-provider ciphertext on omitted credentials, reject partial/blank replacement, sender clearing explicit; UI omits blank secrets + save/test feedback; sidebar SMS link + localized statuses/errors + tab scroll hint | Critical 19 backend GREEN; SMS payload3 GREEN; live credentials preservation pending |
| A141–A147 | Nav rights invoice/read + forms/setting + activity/report; quick booking gate; real links; current role; report/SMS breadcrumb labels; accurate forms/ratings group label; generic error copy | Sidebar/config focused GREEN; remaining shared type/lint/full tests pending |

Fresh focused receipts under ignored `.e2e/dashboard-audit/`: `critical-red.log`, `critical-green.log`, `employee-form-red.log`, `employee-form-green.log`, `date-red.log`, `date-green.log`, `clients-red.log`, `clients-green.log`, `people-bookings-green.log`, `bookings-client-green.log`, `booking-eligibility-red.log`, `booking-eligibility-green.log`, `people-final-focused.log`, `bookings-records-ui.log`.

Important test harness correction: dashboard uses `pnpm --dir apps/dashboard exec vitest run <paths>`; the extra literal `--` after the package test command triggered a full suite and those two accidental logs are not cited as focused RED evidence. ListClients sorting fixture was initially placed in an unrelated describe; its fixture failure was corrected and is not counted as reproduction of the product defect.

## Integrated follow-up
The parent added durable per-form progress for successful vacations/service/branch mutations after independent review: pricing failure then retry does not recreate leave or relationships (8 employee-form regressions GREEN). Forty-four compatibility/permission/retry regressions passed. Refer to integrated-validation.md for persisted API checks, full suites, translations, dates and smoke. Earlier pending annotations above describe the worker checkpoint and are superseded by that integrated evidence.
