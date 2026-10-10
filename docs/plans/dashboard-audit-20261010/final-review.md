# Independent review — repaired integration and staff package

Reviewed on 2026-10-10 in `/Users/tariq/.codex/worktrees/four-groups-integration/sawaa`, branch `codex/dashboard-audit-remediation-20261010`, against HEAD `5f6b9ad0b71d55953d16562c8726c92652759ed4` plus the actual staged/unstaged/new candidate files. This pass revisits all four findings in `review-finance-people.md` and examines the newly integrated staff/user surfaces and owning backend contracts. It supplements the first-pass scope and considered/declined analysis.

**Verdict: no remaining actionable P1/P2 blockers identified in the reviewed source.** All four earlier findings are closed by the current implementation. Ready from this scoped code-review perspective once the coordinator's required integrated validation passes. This is not a claim that CI, browser acceptance, Moyasar sandbox, staging or owner acceptance has passed.

## Closure evidence

| Earlier finding | Actual repaired source and reviewed behavior |
| --- | --- |
| Bank refund request becomes PROCESSING before provider rejection | `apps/backend/src/modules/finance/refund-payment/approve-refund.handler.ts` now selects method and rejects off-gateway payments before `updateMany`. `apps/dashboard/components/features/payments/payment-refund-requests.tsx` classifies manual/card by method and uses `payment:update` for manual settlement, matching the existing controller. The bank-reference and cash regressions assert the request remains PENDING_REVIEW and no provider/claim occurs; missing card reference also leaves it pending. |
| Vacation recreated on employee edit retry | `apps/dashboard/components/features/employees/use-employee-form.ts` retains successful vacation signatures and successful service/branch relationship changes. A retry skips the successfully saved vacation/assignment while retrying later configuration work. The regression intentionally fails pricing after leave and assignment, then asserts one vacation, one assign, and successful retry. Existing explicit schedule/break clearing and omitted-exception preservation remain. |
| Family upload replaces edits made while upload runs | `apps/dashboard/components/features/packages/package-family-editor.tsx` maintains `currentDraft` on each update and merges the eventual image key into that latest draft. External draft notifications still receive the merged value. The async file callback no longer replays the whole upload-start snapshot. |
| Service edit writes a blob preview before failed upload | `apps/dashboard/components/features/services/service-form-page.tsx` now omits imageUrl when a file is pending, the value is blob, or the signed read URL is unchanged. Explicit null removal is preserved. The regression covers upload rejection with old storage retained, a blob without a pending file, and null removal. |

## Staff/user source review

- `user-form-page.tsx` submits only profile fields through the profile PATCH. `user-role-editor.tsx` makes the role PATCH independently, without submitting unsaved profile fields. Hydration is guarded by user identity so the role refetch does not reset profile edits; the role editor remounts on persisted role/custom-role identity changes. Role controls are gated by manage:Role, role/permission GETs by read:Role, and list create/delete/activate/deactivate controls match the existing manage:User endpoints. The edit route's existing update:User guard remains.
- Profile phone clearing is null through the frontend payload, DTO and command; omission continues to preserve it. Failed/missing edit records render error/not-found states rather than a saveable form.
- Get/list user additions select only customRole id/name. Existing passwordHash omission remains, and custom role labels no longer display UUIDs. No new role permissions/secrets are included in that added projection.
- Backend CASL/JWT guards, role-rank enforcement, `UpdateUserRoleHandler` and lookup-user anti-enumeration source have no candidate diff. Splitting UI requests does not alter the server authorization or token-version behavior.
- Password change validation matches the existing server uppercase/digit/minimum-length requirements; reset messaging and login destinations change only presentation/navigation. No new password cap, auth token semantics or enumeration response is introduced.
- User search debounce, role-tab URL fallback, read-only permission matrix and localized profile/role feedback were inspected along with focused tests for their boundaries. No actionable regression identified.

## Evidence and limits

The reviewer inspected actual production code and relevant regression assertions, not only implementation reports. Fresh `git diff --check` exited 0. No tests, build, lint suites, live provider calls or browser actions were run by this reviewer; the coordinator owns integrated validation and remaining test-mock/null-search-params repairs. The reviewer changed only this review document. No product source/index/HEAD/branches, production data, commits, pushes, merges or deployments were changed.

Earlier considered/declined items remain as documented in the first pass: private finance receipt signing, method/balance/provider constraints, SMS omitted-secret preservation, nullable updates, leave preservation, canonical IDs, global sort/cache contracts, Riyadh final-day boundaries and SAR conversion, DIRECT identity preservation and resumable category/service creation. No additional speculative findings or optional style blockers are raised. Token attribution remains unknown.
