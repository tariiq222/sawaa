# Remaining mobile flows — progress and acceptance

تم إصلاح رابط الخصوصية، وعقد حفظ تفضيلات العميل، وأخطاء إعداد الإصدار محليًا. بقية واجهات الميزات وحذف الحساب تنتظر قرارات النطاق والتشغيل؛ إشعارات iOS شُخّصت ولم تُصلح بعد. هذا ليس إعلان جاهزية للمتجر.

Worktree: `/Users/tariq/.codex/worktrees/sawaa-program-checkout/sawaa`, base `95cab4d05`. Prior paid-program checkout changes preserved; original dirty checkout untouched. No commit, push, store submission or deployment.

## Completed in this batch

- Fixed privacy fallback and committed environment examples to `https://sawaa.sa/privacy`. Fresh HTTPS GET returned 200. Published policy text and its approval status were not changed.
- Fixed existing client profile preference contract: optional `preferredLocale` (ar/en) and boolean `pushEnabled` now persist and return saved values. Preference-only requests work; unrelated identity fields/policies are preserved. Raw strings/numbers/null are rejected even with production implicit conversion. DTO/controller/handler tests were aligned with the real middleware after a live synthetic probe caught string-to-boolean coercion.
- Regenerated backend OpenAPI/dashboard types and manually updated API-client PATCH request/response types.
- Corrected local API examples/default to the documented port5200. Production Expo configuration now requires an explicit public HTTPS API URL and fails during configuration resolution for missing/insecure/common local targets. Validation is shared with runtime configuration. This is a configuration mistake guard, not DNS resolution or SSRF protection.
- EAS production build explicitly selects the production environment. Removed invalid `ascTeamId` and literal iOS/Android submit placeholders; optional identifiers/credentials must be selected or configured in the actual EAS/account workflow. No identifiers were invented and no account settings changed.

## Verification

| Check | Result |
|---|---|
| Backend build | Passed |
| Backend preference focused regression | 3 files, 47 passed, 0 failed/skipped |
| Real local HTTP/PostgreSQL preference probe | 6 checks passed: authenticated native write, persisted locale/false, GET readback, unchanged identity fields, malformed boolean400, unauthenticated401 |
| Root typecheck | 8 tasks passed, 4 served from Turbo cache |
| Separate mobile typecheck | Passed |
| Full mobile Jest | 36 suites, 199 passed, 0 failed/skipped; includes prior checkout regressions |
| Actual Expo config tests | Included above: missing production API fails, explicit HTTPS public DNS loads |
| Backend/mobile changed-source lint | Passed, 0 errors; helper globals documented for its dual Node/RN usage |
| iOS Expo export | Passed with explicit `https://api.sawaa.sa/api/v1`; JS/Hermes bundle only, not signed IPA/device acceptance |
| OpenAPI sync | Passed against isolated backend; prior program endpoint addition preserved |
| Full dashboard smoke | 40 passed, 1 failed, 1 skipped. Failure was program post-save navigation timeout; PATCH and follow-up API GET both returned200. Conversation skipped due WEB_CHAT_ENABLED prerequisite |
| Focused dashboard rerun after final backend correction | 8 passed, 0 failed/skipped/flaky: setup, program edit, home and booking mutations. Does not erase the first run's failure |
| HTTPS privacy and git diff check | Passed |

The profile probe used only `sawaa_program_checkout_test_20260922` and a synthetic client; no production/user data was changed. Logs, JSON and reproducible probe/config sources are retained under `.superpowers/sdd/2026-09-22-mobile-remaining/evidence/` (ignored). Parent reviewed actual diffs, caught/fixed two release-validation issues and the real profile coercion issue. Existing payment tests remain in the full mobile suite; real Moyasar/device acceptance is still separate.

## Remaining work and required decisions

1. **Visible incomplete features:** owner choice pending between connecting existing real destinations and hiding unavailable chat/wellness/ratings, or implementing all advertised features. Hard-coded ratings and fake appearance/notification indicators have been identified but not edited in this batch. Client settings still needs server-backed hydration/error recovery; this batch repaired its backend persistence only.
2. **Account deletion:** new in-app request/admin workflow proposal is in `../specs/2026-09-22-mobile-remaining-design.md`. Need approval of workflow, responsible operator, processing time and retention policy. Existing administrative soft-delete retains personal information and is not privacy erasure. No deletion endpoint, migration or real deletion was implemented. Apple permits manual processing with timeframe and completion confirmation, while temporary deactivation alone is insufficient: [official guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
3. **Push:** confirmed raw iOS APNs token incorrectly sent to Firebase Admin FCM. Further coupled gaps: duplicate registration, employee calls to client endpoint, all-device unregister, no token rotation/tap handlers, missing resource IDs in push payload. Recommended repair retains FCM with a native Firebase Messaging token adapter, explicit role/device lifecycle and safe tap data. Staff delivery needs additional storage/endpoints if included in the approved scope. No push-source fix yet; Firebase native configuration and physical-device send/tap remain required. [Expo native-token guidance](https://docs.expo.dev/push-notifications/sending-notifications-custom/).
4. **Release account/device gates:** actual EAS project/production variables, Apple app/team IDs, native Firebase/APNs configuration, signed iPhone/iPad/TestFlight testing and policy/store-content approval remain unverified. Removing placeholders does not supply real values. [Expo EAS configuration](https://docs.expo.dev/eas/json/).
5. **Prior payment gate:** existing Moyasar sandbox key returned401 in the prior task; real checkout/webhook and native Apple Pay remain unverified.

No new feature-scope decision or account-deletion policy was inferred from elapsed time. The pending async questions remain unanswered. Local test backend/Redis are stopped after validation; synthetic database/container and worktree are retained.
