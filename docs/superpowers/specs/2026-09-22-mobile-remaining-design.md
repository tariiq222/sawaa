# Remaining mobile flows — proposed design

Status: UI scope and new account-deletion workflow are proposals awaiting owner decisions. Independent diagnosed privacy, existing preference persistence and release-configuration bug repairs are in progress. Existing paid-program checkout implementation remains preserved in this isolated worktree. No commit, push, deployment, provider/account mutation or real-data deletion is authorized by this document.

## Scope and sequencing

Complete the unresolved mobile readiness paths from the 2026-09-22 audit. Existing bug repairs (privacy/release configuration, real preferences, notification token compatibility) are separate from the new account-deletion workflow. UI feature scope and account-deletion operational policy were requested asynchronously from the owner.

### Existing UI and preference behavior

Recommended scope: connect existing functions rather than leave placeholder actions. Client notifications open the existing client notification screen; appearance uses the existing theme state; profile editing uses the existing profile editor. Employee language/notifications/personal information need role-correct destinations, never client endpoints. Remove hard-coded employee ratings and unavailable feature entry points unless the owner requests full implementation. Chat and wellness have no complete current destination; do not invent content or falsely route them home.

The current client settings code sends preferredLocale and pushEnabled while the backend profile DTO/handler accept only name, phone, email and avatarUrl. Repair this contract with typed/validated optional preference fields, preserve existing identity verification rules, and prove persistence/refetch and failure rollback. Permission denial must not be shown as enabled push. All new server data uses TanStack Query. Shared i18n/config dependencies belong to the coordinator or one explicitly assigned worker.

### Push delivery

The existing expo-notifications device token is APNs on iOS, whereas the server uses Firebase Admin FCM. Preserve the existing sender architecture if a native Firebase token adapter/configuration is viable; compare against introducing Expo gateway or a separate APNs sender before choosing. Fix token type and coupled role/preference/logout/notification-tap behavior as one coherent package. Keep provider secrets out of source. Physical-device delivery and tap acceptance remain required even after unit/build checks.

### Release configuration and privacy

Correct the privacy domain only after checking the actual HTTPS page. Prevent a production build from silently embedding localhost. Preserve explicit development URLs. Use documented EAS Submit fields and do not invent identifiers or rely on unverified literal environment interpolation. Production API, EAS project, Apple app/team identity and native Firebase configuration must be evidenced or left as explicit configuration gates. Do not rewrite policy retention/legal commitments without owner-provided policy.

### Account deletion (new workflow)

Recommended option: authenticated in-app request, identity confirmation, persistent request ID/status, and an administration queue. Request creation must be idempotent for an open request and bind to the authenticated client, not a supplied client ID. Acknowledge request receipt rather than claiming the account has already been deleted. Show the owner-approved processing period and preserve policy-required records. Administrative handling must distinguish review, actual completed deletion and any reason for retained data, with user confirmation of completion.

A dedicated request model/status workflow is preferable to treating a contact-message REPLIED/ARCHIVED status as deletion completion: contact messages lack client ownership and deletion semantics. Use additive migrations and existing permission boundaries, with no guard/token-policy changes. Deletion execution must not reuse DeleteClientHandler as proof of privacy erasure: that existing administrative soft-delete retains personal information and even archives a phone in notes. Do not execute any real deletion as part of development/testing.

Required owner decisions: whether to use this request/admin process; responsible operator; processing period; which records must be retained and under which approved policy. These are product/operational prerequisites, not values the implementation should invent.

Apple permits manual processing with a stated timeframe and completion confirmation; simple temporary deactivation is insufficient. Primary source: https://developer.apple.com/support/offering-account-deletion-in-your-app/

## Verification and delivery

Bounded Luna high implementers with disjoint files; Astra owns contracts, dependencies, generated OpenAPI/dashboard types, integration and final review. Preserve the prior payment fix. Workers run focused tests only. Coordinator runs final mobile suite/typecheck/lint/bundle, relevant backend tests and dashboard smoke for consumed endpoint changes. Test identity/ownership/idempotency for any new request endpoint against isolated synthetic data. Then exercise actual UI paths; separate local mocked/DB/Expo-web evidence from real providers and installed iPhone/iPad acceptance. No publication is implied.
