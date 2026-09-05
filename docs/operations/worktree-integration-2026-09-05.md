# Sawaa local worktree integration — 2026-09-05

Status: source checkpoints preserved; combined candidate verified for local integration into `develop`.

## Preservation

All ten registered worktrees were inventoried before mutation. A private backup at `/Users/tariq/.codex/backups/sawaa/20260905T193923Z` contains original Git refs, source archives with verified SHA256 hashes, staged/unstaged patches, local environment files, and ignored workflow evidence. Dependencies and build caches remain reproducible; every original worktree is retained.

| Source | Preserved commit |
| --- | --- |
| Intake Forms | `d2276f4b` |
| Auth and Payments | `743905ab` |
| Archived notification API draft | `3b3f4454` |
| Safe improvement packages | `5654a00b` |
| Notification Outbox | `35105928` |
| Typed categories and notifications | `1047503b` |

All six commits are ancestors of the combined candidate. The clean archived duplicate worktrees have no unique commits; `codex/unified-web-ai-chat` is already contained in the original main history.

## Integration decisions

- Preserve intake current-row selection, answer revisions, duplicate ambiguity rejection, booking ownership checks, shared parent-row locks, and pair advisory locks. Shared form locks conflict with the editor's exclusive form lock, retaining edit/submission serialization without dropping history protections.
- Use the newer typed notification contract, including unreadOnly and general JSON metadata. Preserve the older draft's commit and plan; do not reintroduce its narrower schema or older API adapter.
- Regenerate backend OpenAPI and dashboard types from the combined backend. The generated output matched the automatic merge byte-for-byte.
- Separate standalone real Redis notification tests from the general E2E configuration, whose setup mocks BullMQ/Redis. Both test lanes are required and run separately.
- Update stale service/intake API mocks and person-row locking fixtures exposed by full integration tests; retain behavioral assertions.
- Return current submission counts consistently while retaining historical-response field immutability. Independent integration review found no remaining P0/P1/P2 findings after this correction.

No old Prisma migration was changed. Three new migrations add response history and the notification outbox schema/constraints.

## Validation

Fresh isolated local PostgreSQL databases and a dedicated Redis container are used. Browser fixtures contain only synthetic role accounts and branch configuration. Detailed command logs are in the private backup folder.

- Node 26 requires `NODE_OPTIONS=--no-experimental-webstorage` for jsdom tests; this is a runner setting, not a product change.
- Test workers are bounded to avoid resource-induced transaction timeouts.
| Check | Result |
| --- | --- |
| Backend unit tests | 817 suites; 7,434 passed, one pre-existing legacy import skip |
| Dashboard / website / shared packages | 3,276 passed (dashboard 2,024; website 762; API client 131; shared 216; UI 143) |
| Critical-result gate script | 9 passed |
| General backend E2E, real PostgreSQL where required | 32 suites, 240 passed |
| Standalone notification PostgreSQL/Redis suites | 2 suites, 35 passed |
| Notification Redis fault/recovery transport | 2 passed with explicit test-container fault opt-in |
| Typecheck / lint / legacy tenant guard | Passed; lint warnings remain, zero errors |
| Backend, dashboard and website build | Passed |
| OpenAPI sync and contract drift | Generated output unchanged; 54 API-client endpoints, 168 dashboard calls, 274 routes checked, 151 known coverage gaps and zero new gaps |
| Prisma migrations | All 98 applied to fresh local databases; no historical migration changed |
| Built-dashboard browser checks | All 43 distinct cases including four auth setup cases passed across the main run and focused follow-up |

Browser details: the first run passed 41 cases, exposed a hard-coded default login fixture, and skipped the conversation case because its fixture was absent. The login spec now reads the configured persona credentials. A synthetic waiting conversation was provisioned in the dedicated test database; the follow-up passed both affected scenarios plus all four auth setup cases. The intake create/edit flow passed. Browser checks used the built dashboard against a built backend in test mode with test-only throttling disabled; they do not certify production-mode provider behavior.

An earlier full backend E2E run had one unexpected HTTP 404 during registration. It did not reproduce in the subsequent full 240-case run; no authentication logic was changed in response. Failure-only response diagnostics were added to the assertion, and the original failure log is retained for future investigation. Earlier resource-concurrent runs are also retained and are not counted as passing evidence.

Evidence files include `backend-unit-final.log`, `frontend-packages-final.log`, `backend-e2e-passing.json`, `notification-real.json`, `outbox-transport-passing.json`, `build-final.log`, `playwright-results.json`, and `playwright-followup-results.json` in the private backup directory. No mobile files changed; root checks do not cover mobile.

## Boundaries

This is local integration into `develop`, according to repository branch policy. No push or deployment is authorized or performed. Existing unfinished finance-policy-dependent packages remain documented in `safe-improvement-release-log.md`; integration does not implement them. A prior Auth/Payments task could not verify the real Moyasar sandbox because the seed key returned HTTP 401. Production activation, provider acceptance, and production backup/restore remain separate gates. Notification Outbox activation remains off by default.
