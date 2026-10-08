# Independent account/auth/settings review

SPEC: PASS for the source implementation of approved Tasks 1–6. Native acceptance remains incomplete.

QUALITY: PASS for local integration, with no actionable P0–P3 source findings. This is a source review gate, not final runtime or release acceptance.

Reviewer: actual session `01a117ed-0f96-75c3-a99d-d400e8d322c9`, assigned `gpt-6.1-sol` / high, policy `sol61-all-v1`. Read-only product review; no children, product edits, validation commands, provider calls or release actions. Only this review report was written.

## Reviewed artifact and scope

Reviewed the orchestrator-built `account-actual-delta.patch` and `account-actual-files.json` in this directory against actual source in `/Users/tariq/.codex/worktrees/mobile-ui-account/sawaa`, the frozen baseline there, `AGENTS.md`, `apps/mobile/CLAUDE.md`, approved `docs/superpowers/specs/2026-10-07-mobile-ui-unification-design.md`, and the complete account Tasks 1–6 brief/context. Author `report.md` provided context, not acceptance.

Frozen artifact SHA-256:

- Patch: `0b65b8af27fad5cd80bf1f6a9d8ed3c69b4fb4a050c0c7a37de79470cf353ec0`.
- Manifest: `cfb5a2317ae244e8760a88a49aad7502b1594e2a548b8af3a215c4e5c3fef53b`.

All reviewed product paths below are relative to `/Users/tariq/.codex/worktrees/mobile-ui-account/sawaa/apps/mobile/`. The actual delta is confined to the approved account lane source/test ownership. Shared foundation contracts were consumed; they were not reimplemented or reexplored. Sensitive services/hooks, session stores, layouts, server/API contracts, permission guards and payment behavior have no lane delta. Register's email-entry re-export and the account-tab wrapper remain intact.

## Task-by-task spec and quality evidence

| Task | Source review and acceptance judgment |
| --- | --- |
| 1: profile/settings scaffold | `components/features/settings/SettingsScaffold.tsx` owns one safe scroll padding and optional platform KeyboardAvoidingView; `app/(client)/settings-profile.tsx` enables it. Back uses the explicit client-account fallback while preserving history. `SettingsProfileSection.tsx` uses real Controller-rendered LabeledInput fields with LTR phone/email, locale name direction, existing error mapping and AppButton busy/disabled Save. Schema, assigned-email read-only explanation, assigned-email omission from update payload, optional missing-email payload, canonical response/name split/reset, Haptics and request arguments are unchanged. PASS source. |
| 2: auth/status forms | `components/features/auth/AuthFormScaffold.tsx` owns scroll, handled keyboard taps, one safe padding and supplied optional header callback; it owns no navigation/session logic. Login retains logo, intro, booking-dependent guest visibility, exact guest replacement and continuation links. Review login retains username/password native hints, pending input lock, onSubmitEditing, ref duplicate guard, profile/epoch checks, cleanup and booking-before-redirect continuation. Recovery preserves minimum-four code validation, eight-character password/mismatch validation, sessionToken flow, service argument order and Alert-button return route while localizing copy. OTP retains one native four-character TextInput overlay, oneTimeCode/sms-otp/maxLength, digit filtering, paste/autosubmit, session protection, purpose-specific resend and 60-second cooldown; boxes now use minHeight without disabling text scaling. Email-entry preserves supplied flow.exit, six-character native field and phone-dependent autocomplete, pending/expiry/cooldown conditions, consent/phone checks, retry/restart/use-phone callbacks. Optional EmailForm/PhoneForm pending props separate actual requests from cooldown-only disabling. Suspended remains without a back control and retains logout/guest replacements. PASS source. |
| 3: summary/history/inbox | `app/(client)/profile.tsx` shows first-read loading without fabricated values, neutral missing-value dashes, stale summary values plus explicit error/read-only refetch, unchanged integer-halalas conversion and month/date semantics. Names/stats can wrap and edit remains the original profile-settings destination. Pushed profile and notifications have client-account cold-link fallbacks; tab profile stays backless. `records.tsx` retains completed/limit-50 request, response order, IDs and destinations; complete accessibility labels include practitioner/service/date/time. Error/empty presentation uses EmptyState, names/service/date groups wrap, alpha uses withAlpha. Profile/history/inbox entrances honor Reduce Motion and long-list delays cap at 240ms. `notifications.tsx` retains focus refresh, filters, loaded items on next-page failure, mark-read/deeplink handling and mark-all; retry remains existing loadMore, with current loadingMore controls. PASS source. |
| 4: preferences/About | `app/(client)/settings.tsx` distinguishes pending/error/off/device-permission states and error retry invokes only the existing query refetch. The original `enabled === true && permitted === true` calculation and `isPending || isError || mutation.isPending` disabling are preserved. Permission requests are not newly triggered by rendering or retry. Mutation, locale storage/server sync/restart Alert, theme choices and privacy URL callbacks remain unchanged. It consumes shared AboutSection and removes the duplicate version/About renderer. PASS source. |
| 5: delete/verification | `components/features/settings/DeleteAccountButton.tsx` consumes semantic scrim directly and AppButton danger, uses available-height internal scrolling and a single bottom safe inset, modal accessibility and Reduce Motion. `confirm()` still closes the sheet before invoking the request; `pending.current` still prevents duplicate requests. Trigger reflects busy/disabled state. Cancel/backdrop remain request-free. `components/features/auth/UnverifiedEmailBanner.tsx` preserves absent user/CLIENT/already-verified visibility, existing verification mutation, success branch and Haptics while adding localized failure/retry, pending busy disabling and polite success feedback. PASS source. |
| 6: guest prompts | `components/features/guest/GuestSignInPrompt.tsx` is presentation-only with no router/auth state. Both consumers retain `router.push('/(auth)/login')`; guest account retains its visitor-introduction card and secondary action; appointments uses primary. Surface renderer, gutters, spacing/radius, locale text and CalendarDays icon follow the frozen contract. No booking/user data is invented. PASS source. |

## Test/evidence assessment

Inspected actual changed tests and stored command outputs without rerunning tests. Meaningful new coverage checks supplied back callbacks and cold-link fallbacks, busy Save, native single-input OTP props, pending review-login input locks/onSubmitEditing, AR/EN recovery validation with zero invalid writes, missing/stale-summary read retry, complete record actions and 50-item ordering/delay, preference read retry versus mutation, verification failure/retry/visibility/pending/success, deletion cancel/backdrop/duplicate protection, guest destinations and supplied prompt callback. Existing auth/session/continuation, inbox content/stale/filter and assigned-email/canonical-profile coverage is retained. Removed notification style/truncation assertions follow the approved move to simulator acceptance; component text presence does not prove geometry.

Inspected `account/.superpowers/sdd/2026-10-07-mobile-ui-account/focused-final.log` in the account worktree: 20 suites / 109 tests passed. Inspected `review-focused.log`: affected 3 suites / 19 tests passed without the earlier native icon hydration warning. These are the writer's recorded focused execution evidence, not a reviewer-run comprehensive gate. The coordinator must still run integrated Jest/types/lint and shared foundation contrast tests against the integrated source.

Changed product source is below the 350-line limit (reported maximum 285, consistent with inspected source). The OTP protection test was already 463 lines and the narrow new assertion produces 464; this pre-existing test-size exception is explicitly reported and is not a hidden new product-file violation. No broad test restructuring is needed for this presentation delta.

## Actionable findings

None. No source remedy is required before applying this frozen lane delta. This verdict should be reevaluated if the artifact/source changes materially.

## Native acceptance still required

- Task 1: iOS and Android small-phone profile at 200% text with the last field focused, localized validation visible, Save reachable/usable, correct Arabic name and LTR phone/email, and no doubled bottom inset after keyboard dismissal.
- Task 2: native four-digit OTP paste/autofill and single overlay input, six-digit email/phone entry autofill, expiry/cooldown presentation, last action reachability with keyboard/200%, supplied auth exits/continuations and suspended escape. Jest input props and simulated changeText are not keyboard/provider acceptance.
- Task 3: long AR/EN practitioner/service/profile names, three summary values including date/money, 50 records and Reduce Motion, stale-summary failure/retry and stale inbox page at 200%; verify card actions and wrapping on actual native geometry.
- Task 4: pending → failure → read retry → off/blocked states, large-text preference rows/About and both roles' real version/build display using the shared foundation acceptance.
- Task 5: native light/dark danger/scrim rendering, small-phone 200% sheet confirm/cancel reachability, screen-reader modal focus isolation and return focus, reduced-motion modal, pending trigger and verification announcements. Do not perform a live account deletion to validate presentation.
- Task 6: AR/EN light/dark guest cards, long sign-in text at 200%, action hierarchy and safe tab footer.

The final matrix must identify platform/device, small/large phone, locale, scheme, 200% text, keyboard, Reduce Motion and cold-link cases. Unrendered states remain unverified. Simulator evidence and physical-device/provider evidence must be labeled separately. This review has no runtime, physical-device, real-provider or release acceptance evidence.

## Measurement

Before product source review, captured actual-session baseline with the fixed `--since 20261007` window at `/Users/tariq/.codex/routing-review/account-review-01a117ed-before.json`; checkpoint at `/Users/tariq/.codex/routing-review/account-review-01a117ed-after.json`. Initial brief/instrumentation predates baseline, final response/parent acceptance postdates checkpoint, and full-task participant attribution is incomplete. Whole-task consumption and allowance savings remain unknown; cache/reasoning are subsets, not additional totals. Parent owns receipt attachment and final acceptance.
