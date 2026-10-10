# Independent review — first pass

Reviewed on 2026-10-10 against HEAD `5f6b9ad0b71d55953d16562c8726c92652759ed4`, branch `codex/dashboard-audit-remediation-20261010`, using actual staged, unstaged and new source. Scope: incorporated finance, people/SMS/bookings/shared/operations and catalog remediation. The separate staff package was not yet handed over and is excluded from this verdict. No product source, index, HEAD or branches were changed by the reviewer. No tests or broad suites were run; integrated verification belongs to the coordinator. This report is source evidence, not live/Moyasar/staging acceptance. Token attribution is unknown.

Verdict: **not ready to merge this reviewed snapshot**. Four actionable P2 findings remain; no P1 identified. The coordinator has acknowledged the findings and is assigning repairs. Re-review the repaired source and final staff package before the final verdict.

## Findings

### P2 — classify reviewed bank-transfer refunds before claiming the provider request

Changed guard: `/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/backend/src/modules/finance/refund-payment/refund-payment.handler.ts:512`.

Related callers: `/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/dashboard/components/features/payments/payment-refund-requests.tsx:14` and `:32`; `/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/backend/src/modules/finance/refund-payment/approve-refund.handler.ts:46` and `:64`.

An approved BANK_TRANSFER stores its bank reference in `gatewayRef`. A pending reviewed refund for that payment is still presented as a gateway approval because `PaymentRefundRequests` classifies by reference presence. `ApproveRefundHandler` also checks reference presence without selecting/checking method, then persists PROCESSING/BEFORE_CALL. The new provider guard correctly refuses BANK_TRANSFER, but the request remains PROCESSING; it cannot then use the manual exact-request endpoint, which requires PENDING_REVIEW. Ordinary bank transfers therefore acquire an unusable refund request through this UI.

Remedy: classify every review action by `method === ONLINE_CARD`; use the existing `update:Payment` permission for off-gateway settlement. In approval, select/check method before changing request status. Test a BANK_TRANSFER with a bank reference and PENDING_REVIEW request: manual settlement is offered, and accidental provider approval rejects without a state transition or provider call.

### P2 — retain successful vacation creation across an edit retry

`/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/dashboard/components/features/employees/use-employee-form.ts:255` and `:317`.

When vacation creation succeeds but a later service/branch step fails, the new partial-failure return keeps the edit form open. Its vacation draft remains enabled, so every retry calls create again. `CreateEmployeeExceptionHandler` performs an unconditional create and has no deduplication. A later recoverable failure thus leaves duplicate persisted leave rows.

Remedy: retain the created vacation identity or mark that step completed, while supporting intentional later draft changes. A focused regression should create vacation successfully, fail a later step, retry, and assert one persisted vacation/create call.

### P2 — merge a finished family-image upload into the latest draft

`/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/dashboard/components/features/packages/package-family-editor.tsx:101`; async callback `/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/dashboard/components/features/packages/package-family-image-field.tsx:24`.

The upload callback captures the editor's entire `value` at upload start. While `isUploading` disables Save and the file field, the remaining family fields/options stay editable (`fieldset` is disabled only during submission). Completing the upload calls `update({ ...value, imageUrl })` with the old snapshot and silently discards edits made during the upload.

Remedy: merge the image into the current draft through a functional update/latest-draft reference, preserving the editor's external change notification; alternatively disable all editable fields throughout upload. Test delayed upload, a concurrent name/option edit, then upload resolution, and assert the edit survives.

### P2 — preserve preview filtering in the service edit image override

`/Users/tariq/.codex/worktrees/four-groups-integration/sawaa/apps/dashboard/components/features/services/service-form-page.tsx:165`.

Selecting an image in `BasicInfoTab` sets `data.imageUrl` to a browser `blob:` preview and retains the file for upload. `buildPayload` already omits previews, but the new explicit image override writes the blob URL back into the update payload. The update persists before `uploadServiceImage`. If upload fails, the old image is already replaced by a browser-local URL that cannot work on later reads.

Remedy: omit `imageUrl` when a file is pending or the value starts with `blob:`, while retaining `null` for explicit removal and omission for an unchanged signed read URL. Test edit with selected file and rejected upload: the initial PATCH must not contain the blob or destroy the existing image.

## Considered and declined as findings

- Gateway partial-refund remaining balance: hiding a second ONLINE_CARD refund matches the existing explicit Moyasar second-refund restriction. It must not be rerouted as manual cash accounting. Off-gateway partial refunds now expose remaining balance and omitted automatic amounts use the outstanding balance.
- Provider/manual separation in direct and cancellation paths, invoice/payment lock order, provider identity/currency/amount/baseline checks and one-call lease/reconciliation state machine: no additional regression identified in reviewed changes. The reviewed-request caller mismatch above remains the exception.
- Private bank receipt signing: the owning uploader stores the private finance-receipts bucket URL; the new signer resolves that owned path. StorageModule already supplies MinioService. No demonstrated bucket/permission regression.
- SMS sender-only updates: omitted credentials preserve the existing ciphertext; complete provider replacements are required; NONE clears credentials. Encryption AAD/constants remain unchanged. No credential-erasure finding.
- Availability exceptions: omitted exceptions preserve stored leave, explicit empty exceptions clears it. Empty schedules and breaks are now saved; edit submission waits for those datasets to hydrate. No silent leave deletion/default-hours finding.
- Nullable client/employee/department/coupon updates: reviewed optional storage fields and serializers support the intended clearing. Client phone is nullable. One-part client names no longer duplicate the name; DTO accepts an empty last name.
- Client invoice/statistics tabs use canonical client ID and the corresponding read permission; employee detail subqueries use canonical ID. Client global sorting is applied before pagination; unsupported appointment column sorting is disabled.
- Booking status URL entry/default time tab and server chronological ordering: no regression identified in the reviewed initial-load contract. Invalid status values fall back to all.
- Riyadh date-only report boundaries, inclusive final-day adapter, half-open revenue query, Gregorian rendering, revenue chart and Excel halala-to-SAR conversion: no additional material defect identified. No live export/provider evidence was inferred from unit/source evidence.
- Catalog GET detail endpoints, complete category picker pagination, server-side service sorting/filter/cache keys, active employee branch linkage and relevant relationship cache invalidations: no additional actionable regression identified. Hidden DIRECT service identity protections remain intact.
- Category/service creation retains the same successfully created record for retry and reconciles service employees, rather than creating another record after a later failure. Category booking mode remains locked after persistence. No duplicate-create finding in these helpers.
- Omitting unchanged signed image URLs in category/package/grouped/family edits is appropriate. The service preview override above is a distinct failure path.

Optional style suggestions: none worth blocking or distracting from these behavior fixes.
