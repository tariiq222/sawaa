# Mobile Native Moyasar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hosted checkout in every existing mobile payment entry with the official Moyasar SDK, including Mada and the official Apple Pay button, while preserving website checkout.

**Architecture:** Add authenticated native payment initialization and reconciliation. Bind the provider UUID to a reserved Payment before returning configuration; share authoritative settlement with the authenticated webhook path. Route booking, remaining-balance and package payments through one native screen and continue to read server booking/purchase status before displaying success.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, Expo SDK 55, RN 0.83, Expo Router, TanStack Query, react-native-moyasar-sdk 0.15.0, Expo-compatible react-native-webview, existing react-native-svg, PassKit via a small local Expo capability module.

**Spec:** `docs/superpowers/specs/2026-10-05-mobile-native-moyasar-design.md`, approved by the owner on 2026-10-05. Plan status: approved; local implementation and bounded Sandbox acceptance completed, physical Apple Pay and publication remain pending. See `docs/mobile-app/releases/2026-10-05-native-moyasar.md` for executed evidence and remaining acceptance.

## Global Constraints

- التطبيق فقط. Website/public hosted endpoints retain their existing response shapes and defaults.
- Invoice/Payment amounts are integer halalas; amount and currency come from the server, never from route-price parameters.
- The SDK is the official `react-native-moyasar-sdk`, current documented version `0.15.0`; verify registry version and native compatibility before adding it. Keep Expo 55/RN 0.83; do not upgrade the platform to resolve an SDK issue without a separate decision.
- No PAN, CVC, Apple payment token or raw SDK result enters Sawaa API, persistence, logs, analytics or Sentry.
- No saved-card/tokenization, installments, splits, new payment methods or changes to booking/service eligibility.
- No changes to DEFAULT_ORG_ID, PLATFORM_SETTINGS_KEY, encryption AAD, VAT defaults, guards, permissions or token semantics.
- Backend endpoints require OpenAPI sync and dashboard smoke. Native payment changes require real Moyasar Sandbox verification.
- Do not commit, push, merge, deploy, upload TestFlight or submit App Review under this implementation approval. Follow deployment policy separately at each applicable boundary.
- Preserve the existing uncommitted guest-resume fix and unrelated files. Use `/Users/tariq/.codex/worktrees/guest-booking-resume/sawaa`; do not modify the dirty primary checkout or install through its symlinked node_modules.
- Mobile commands run with `pnpm --dir apps/mobile`; root workspace commands exclude mobile. Keep new mobile files below 350 lines, translations in ar.json/en.json, and colors from existing theme tokens.
- A native rebuild is required. Apple Pay cannot be accepted from Simulator evidence; report device verification separately.

## Review Focus

1. An SDK timeout or provider 404 before payment creation: resume the same givenId; never delete the reservation or allocate a second charge.
2. A pending attempt followed by a catalog-price change or invoice closure: freeze the payable attempt against its invoice; reject stale/closed eligibility and preserve late-payment accounting rules.
3. Switching between website hosted checkout, mobile native checkout and bank transfer: one active reservation, a clear conflict, and no automatic hosted fallback.
4. Apple Pay dismissal without an SDK callback: keep the screen usable, reconcile on foreground/check-again, and never infer failure or success from dismissal.
5. Logout or account switching with a stored pending checkout: do not display another client's attempt, poll it or clear its identity as if it belonged to the new client.

Each condition is pinned by the focused tests in Tasks 2–5 and the real concurrency/device checks in Task 6.

## Decomposition and ownership

| Slice | Owned files/symbols | Independence |
|---|---|---|
| Server contract/settlement | shared native-payment types; finance native slices; reservation helpers; webhook settlement boundary; mobile payments controller | Prerequisite for all callers. Tasks 1–3 sequential. |
| SDK and capability UI | mobile features/payments; local PassKit module; app config; dependencies and translations | Dependent on Task 1 contract and Task 3 endpoints; independent of route rewiring after interfaces are fixed. |
| Mobile entry/resume wiring | booking payment hook/screens, package checkout/service/query/return, payment resume state | Dependent on server contract and SDK screen target. Shares mobile services and translations with SDK slice, so use one writer. |
| Acceptance/review | focused/full checks, real Sandbox evidence, dashboard smoke, release docs | Dependent on the integrated patch; reviewer read-only. |

Execution: **Three native Astra agents in this session**, selected by the owner. Backend/shared, SDK/capabilities, and mobile route wiring have disjoint file ownership under a frozen contract recorded in `.superpowers/sdd/2026-10-05-mobile-native-moyasar/context.md`. Tasks 1–3 remain sequential within the backend package; Tasks 4 and 5 execute concurrently. The coordinator integrates and performs final checks, with independent review after handoff. No commit or publication is authorized. Actual coordinator model/effort is not changed by this document; task-only token attribution remains unknown because earlier usage overlaps this session.

## Contract and file map

Create shared types in `packages/shared/types/native-payment.ts`, export from `packages/shared/types/index.ts`. Backend DTOs describe these responses in Swagger; mobile services consume shared types. Do not change existing `InitPackagePurchaseResponse` used by website.

```ts
export type NativePaymentMethod = 'ONLINE_CARD' | 'APPLE_PAY';
export interface NativeApplePayConfig {
  merchantId: string;
  label: string;
  countryCode: 'SA';
}
export interface NativePaymentCapabilities {
  enabled: boolean;
  isLive: boolean;
  supportedNetworks: Array<'mada' | 'visa' | 'mastercard'>;
  applePay: NativeApplePayConfig | null;
}
export interface NativePaymentConfiguration extends NativePaymentCapabilities {
  publishableKey: string;
  givenId: string;
  amount: number;
  currency: string;
  description: string;
}
export interface NativePaymentInitResponse {
  paymentId: string;
  invoiceId: string;
  config: NativePaymentConfiguration;
}
export interface NativePackagePurchaseInitResponse extends NativePaymentInitResponse {
  purchaseId: string;
}
export interface NativePaymentReconcileResponse {
  paymentId: string;
  invoiceId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  requiresReview: boolean;
}
```

Native route parameters: `{ invoiceId, bookingId?, purchaseId?, method?: NativePaymentMethod }`. At least one of bookingId or purchaseId must belong to invoiceId; check via authenticated reads before showing the payable screen. Pending storage includes current `clientId`, invoiceId, paymentId and target IDs; never store SDK configuration or public-key copies as the source of current truth.

Endpoints beneath `/mobile/client/payments`:

| Endpoint | Input | Output |
|---|---|---|
| `GET native/config` | Current authenticated client session | NativePaymentCapabilities; only declares Apple ready from explicit server configuration |
| `POST native/init` | Existing InitClientPaymentDto (invoiceId/method), identity from session | NativePaymentInitResponse |
| `POST package-purchases/native/init` | Existing InitPackagePurchaseDto, identity from session | NativePackagePurchaseInitResponse |
| `POST native/:paymentId/reconcile` | Path UUID only; reject a request body containing amount/status/alternate provider ID | NativePaymentReconcileResponse |

`GET native/config` supports the approved method chooser without creating a booking/payment just to check availability. New HTTP statuses retain the app's standard error envelope. Add stable conflict codes `NATIVE_PAYMENT_IN_PROGRESS`, `HOSTED_PAYMENT_IN_PROGRESS`, `PAYMENT_ALREADY_COMPLETED` and `PAYMENT_CONFIGURATION_CHANGED` using the existing exception conventions. A completed provider attempt is reconciled before returning PAYMENT_ALREADY_COMPLETED; callers refresh operational booking/purchase status instead of charging again.

## Task 1: Publish native contract and safe capabilities

**Files:** Create `packages/shared/types/native-payment.ts`; modify its types index. Create `apps/backend/src/modules/finance/native-payments/get-native-payment-config/{get-native-payment-config.handler.ts,get-native-payment-config.handler.spec.ts}`. Modify finance.module.ts, mobile/client/payments.controller.ts and its spec, `apps/backend/.env.example`.

**Interfaces:** `GetNativePaymentConfigHandler.execute(): Promise<NativePaymentCapabilities>` and `getPaymentConfiguration(): Promise<Omit<NativePaymentConfiguration, 'givenId' | 'amount' | 'currency' | 'description'>>` for server initialization. Both read the existing singleton publishable key/config, never decrypt or return the secret/webhook key. `enabled` requires current online-payment settings plus a nonempty publishable key whose test/live prefix matches `isLive`; malformed configuration fails closed.

- [ ] Write configuration tests for disabled online payments, absent config, prefix/isLive mismatch, no Apple env, partial Apple env, complete Apple env, and exact safe returned keys. Test routes cannot return encrypted secrets.

```ts
// Use the existing get-moyasar-config spec's Prisma singleton mock and
// ConfigService test provider to construct GetNativePaymentConfigHandler.
const config = await handler.execute();
expect(config.applePay).toBeNull();
expect(Object.keys(config).sort()).toEqual(
  ['applePay', 'enabled', 'isLive', 'supportedNetworks'].sort(),
);
expect(config.supportedNetworks).toEqual(['mada', 'visa', 'mastercard']);
```

- [ ] Run the new handler/controller tests; record the intended RED before adding the provider/route. No product dependencies installed yet.
- [ ] Implement safe config mapping and `GET native/config`, with existing ClientSession guard/decorator. Add nonsecret env declarations: `MOYASAR_APPLE_PAY_ENABLED=false`, `MOYASAR_APPLE_PAY_MERCHANT_ID=` and `MOYASAR_APPLE_PAY_MERCHANT_LABEL=`. Apple requires true flag + valid `merchant.*` ID + label. Country is SA. Reuse ConfigService, not new mutable global settings.
- [ ] Export shared types; build shared before consumer checks. Run focused tests again. Check capability changes invalidate mobile queries after auth identity changes. No secret rotation or encryption refactor.

**Deliverable:** A tested, additive capability endpoint and complete shared types. Document PASS/FAIL evidence; do not commit.

## Task 2: Share authoritative settlement and add owner-bound reconciliation

**Files:** Create `apps/backend/src/modules/finance/native-payments/reconcile-native-payment/{reconcile-native-payment.handler.ts,reconcile-native-payment.handler.spec.ts}` and `apps/backend/src/modules/finance/moyasar-payment-settlement/{moyasar-payment-settlement.handler.ts,moyasar-payment-settlement.handler.spec.ts}`. Modify moyasar-webhook.handler.ts/spec, finance.module.ts, mobile/client/payments.controller.ts/spec. Extend moyasar-api.client.ts/spec only for response fields actually required (provider message/identity), preserving existing shapes.

**Interfaces:** `ReconcileNativePaymentHandler.execute({ clientId, paymentId }): Promise<NativePaymentReconcileResponse>`. Settlement `execute({ invoiceId, gatewayPaymentId, gatewayRefs, fetched, message?, requiredPaymentId? }): Promise<{ skipped?: boolean; reason?: string; requiresReview: boolean }>` consumes a provider-fetched response, not HTTP input. `fetched` uses the existing exported MoyasarPaymentStatusResult. For the native caller, requiredPaymentId is mandatory and gatewayPaymentId must equal its persisted gatewayRef. Webhook still performs its own signature/secret verification and durable claim before invoking settlement.

- [ ] Add tests proving missing signature/body-secret still rejects the public webhook, and authenticated native reconcile refuses another owner's payment **before any provider call**.

```ts
// Add within the new reconciliation spec with its Prisma payment/invoice mock.
prisma.invoice.findFirst.mockResolvedValue({ id: invoiceId, clientId: 'other-client' });
await expect(handler.execute({ clientId, paymentId })).rejects.toThrow(ForbiddenException);
expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
```

- [ ] Pin shared result application with failed/captured/paid/authorized/initiated, duplicate COMPLETED, duplicate FAILED, refund replay, mismatched UUID, amount, currency, and spoofed invoice metadata tests. Copy current transaction/outbox expectations before extracting them; no rewriting of financial rules.
- [ ] Run focused new and existing webhook tests to RED for missing native path, then move only the authoritative route/mutation/outbox portion into settlement. Keep webhook claim leases, HMAC/body-secret checks, system CLS setup and claim completion in its wrapper. Preserve booking → invoice → payment lock order, zero-VAT behavior and event organizationId.
- [ ] Implement owner-bound native fetch using stored gatewayRef; never accept a provider ID/body status from the caller. Native attempts use internal Payment.id as their givenId/gatewayRef, so native-only endpoints reject rows whose gatewayRef differs from their id. A provider 404 returns current PENDING and performs no deletion/update; timeout/5xx returns retriable API failure. Fetch ID, amount and currency must match persisted attempt; reject mismatch without claiming success.
- [ ] Ensure idempotent **state transitions**, not only webhook-event dedup: native and webhook may arrive concurrently under different wrappers. Under the payment lock, an already-settled same-status row causes no second event/outbox insert. Retain existing stable event IDs.
- [ ] Add late cancelled/expired booking tests that record a payment and one PENDING_REVIEW refund request, without PaymentCompletedEvent. Closed invoice retains existing manual-review policy; return requiresReview so app cannot show booking success. Add catalog repricing test: existing frozen invoice/attempt unchanged; an actual invoice amount/currency incompatibility rejects settlement.
- [ ] Run focused reconciliation/settlement/webhook suites; do not broaden to the full suite until integration.

**Deliverable:** Both entry paths apply provider-authoritative results once, with unchanged public webhook authentication. No fake signed webhook is constructed.

## Task 3: Reserve native attempts for invoices and package purchases

**Files:** Create `apps/backend/src/modules/finance/native-payments/init-native-payment/{init-native-payment.handler.ts,init-native-payment.handler.spec.ts}`. Modify payments/client/init-client-payment/init-client-payment.handler.ts/spec and its reconcile-in-flight-payment.helper.ts/spec only for cross-mode safety. Modify package-purchases/init-package-purchase/init-package-purchase.handler.ts/spec to support an internal native command; add `init-native-package-purchase.handler.ts/spec` wrapper beside it. Modify finance.module.ts and mobile/client/payments.controller.ts/spec and package-purchase-init.http.spec.ts. Preserve api/public/payments.controller.ts behavior and test it.

**Interfaces:** `InitNativePaymentHandler.execute({ clientId, invoiceId, method? }): Promise<NativePaymentInitResponse>`. `InitNativePackagePurchaseHandler.execute(InitPackagePurchaseCommand): Promise<NativePackagePurchaseInitResponse>`. Shared purchase initialization has an **internal** mode defaulting to HOSTED; no public DTO field allows a website caller to accidentally change the response contract. Use an overloaded/internal native method rather than weakening all responses to an optional redirectUrl.

- [ ] Add tests for ownership, disabled payment, nonpayable invoice, expired program hold, pending bank transfer/hosted/native competitor, safe integer amount, and native mode not calling createCheckoutInvoice.

```ts
// Use typed copies of the existing init-client-payment buildHandler fixture.
const result = await handler.execute({ clientId, invoiceId, method: 'ONLINE_CARD' });
expect(result.config.amount).toBe(230);
expect(result.config.givenId).toBe(result.paymentId);
expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
  data: expect.objectContaining({
    id: result.paymentId, gatewayRef: result.paymentId,
    amount: 230, status: PaymentStatus.PENDING,
  }),
}));
expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
expect(result).not.toHaveProperty('redirectUrl');
```

- [ ] Record RED, then implement reservation using randomUUID for Payment.id and gatewayRef in the same transaction. Maintain an invoice-scoped native idempotency key and existing pending-reservation check. Include booking lock before invoice lock when booking rules are read. Calculate safe integer outstanding via existing money/deposit helpers; do not multiply stored halalas by 100. Reject Apple init when configuration is not ready.
- [ ] Existing native attempt: fetch and reconcile before deciding. Provider 404 means return the same UUID and amount; initiated/authorized means reconcile the same attempt without returning a new card form or reusing a consumed bank URL; paid/captured means settle and signal PAYMENT_ALREADY_COMPLETED, never allocate another UUID in that request. FAILED/voided proven by provider allows the next explicit attempt using the existing terminal replacement helper under lock.
- [ ] Change hosted initializers to recognize a pending native row before hosted lookup and return NATIVE_PAYMENT_IN_PROGRESS. Native initializer refuses active hosted attempts with HOSTED_PAYMENT_IN_PROGRESS, including hosted-creation outcomes still unknown. Provider-confirmed expired/failed hosted attempt may release its reservation using current checked replacement rules before native initialization. Network ambiguity never releases a reservation.
- [ ] Package native path reuses existing price/branch/family validation and frozen offer/credit snapshots. In native mode, `materializePending` binds Payment.id=gatewayRef before return and skips hosted invoice creation/recovery. Preserve existing `client-pkg:<invoice>` payment reservation and purchase idempotency fingerprints; concurrent native/hosted reuse of the same purchase key cannot materialize a second purchase. Pass mode explicitly through new/existing reservation helpers. Default mode stays HOSTED for all existing callers.
- [ ] Add package tests for standalone/family/GROUPED_V2, changed current price after a keyed attempt, amount below gateway minimum, old paid attempt key, native provider 404, active hosted competitor, and activation exactly once. Test a new native request cannot rejudge a frozen purchase against today's price.
- [ ] Add HTTP endpoint tests: current session injects identity; path UUID validation; no accepted amount/status/provider-ID body; static native/config routes before dynamic payment routes; rate limits use existing conventions.
- [ ] Run focused native-init, package-init, reservation helper, public/mobile controller tests. Run `pnpm openapi:sync`, inspect only expected additive paths and generated dashboard types (`apps/dashboard/lib/types/api.generated.ts`); update hand-written api-client only if a consumed contract changes. Shared website purchase types stay unchanged.

**Deliverable:** Native responses contain no hosted URL and never create a hosted Moyasar invoice. Website still receives its exact hosted response. Configuration mismatch or ambiguity fails closed.

## Task 4: SDK adapter, capability bridge and native screen

**Files:** Create `apps/mobile/features/payments/{native-payment-config.ts,native-payment-capabilities.ts,use-native-payment-checkout.ts,NativePaymentForm.tsx}` and their `__tests__` files; create `app/(client)/payments/native-checkout.tsx` and screen tests. Modify services/client/payments.ts and service tests, app.config.ts/test, package.json, mobile pnpm-lock.yaml, i18n/ar.json/en.json. Create local `modules/sawaa-payments/{expo-module.config.json,index.ts,ios/SawaaPaymentsModule.swift,ios/SawaaPayments.podspec}`. Add local-module native build inclusion using Expo's supported autolinking.

**Interfaces:** Services `getNativeConfig()`, `initNativePayment(invoiceId, method)`, `reconcileNativePayment(paymentId)` use shared response types and exact endpoints above. `createNativePaymentConfig(config): PaymentConfig` has no route-price parameter. `canUseNativeApplePay(config, builtMerchantId): Promise<boolean>` requires iOS, server ready, matching built ID, and PassKit network capability. `useNativePaymentCheckout({ clientId, invoiceId, bookingId?, purchaseId?, method })` exposes phase, config, paymentId, reconcile, retryInitialization and error; manages one in-flight initialization/reconcile and clears SDK form after receiving a result.

- [ ] Before dependency installation, inspect symlink targets. Give this worktree its own mobile dependency installation; preserve the primary checkout's node_modules and lockfiles. Root/shared deps may remain read-only symlinks. Stop/repoint the existing QA Metro deliberately so it loads this worktree's native dependency graph.
- [ ] Add tests for direct service endpoints and exact bodies, public-key-only config, invalid server amount/UUID, test/live mismatch, merchant mismatch, Android, absent module, and no capable Wallet. Record RED.
- [ ] Verify npm registry metadata for SDK 0.15.0 and peer requirements. Add SDK pinned to 0.15.0 and Expo-compatible webview; retain existing SVG version. Adapt Jest transforms by extending existing patterns, not replacing them. Rebuild native pods/project from the worktree; do not reuse an old binary as SDK build evidence.
- [ ] Implement config mapping with provider-default URL, country SA and server amount. Disable provider auto-coupons because the invoice is the exact payable amount. Disable saved-card/tokenization. The following is the adapter's core, not a route-derived payment request:

```ts
return new PaymentConfig({
  givenId: config.givenId,
  publishableApiKey: config.publishableKey,
  amount: config.amount,
  currency: config.currency,
  description: config.description,
  merchantCountryCode: 'SA',
  supportedNetworks: config.supportedNetworks,
  creditCard: new CreditCardConfig({ manual: false, saveCard: false }),
  createSaveOnlyToken: false,
  applyCoupon: false,
  ...(config.applePay ? { applePay: new ApplePayConfig({
    merchantId: config.applePay.merchantId,
    label: config.applePay.label, manual: false, saveCard: false,
  }) } : {}),
});
```

- [ ] Add build variable `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` and config `extra.applePayMerchantId`; only add `com.apple.developer.in-app-payments` when a valid merchant ID is provided. Reject malformed nonempty ID at config evaluation. This value is a merchant identifier, never a secret key. Config tests inspect missing/valid/malformed values.
- [ ] SDK 0.15.0 public exports do not expose an Apple capability helper. Use a local Expo module named `SawaaPayments` with function `canUseApplePay(networks: string[]): boolean`. Swift imports ExpoModulesCore and PassKit and calls `PKPaymentAuthorizationController.canMakePayments(usingNetworks:)` for mada/visa/mastercard; unknown networks fail closed. JS uses requireOptionalNativeModule, returns false on unsupported platform/missing module/exception. Do not deep-import undocumented SDK internals or draw a custom Apple button.
- [ ] Render official CreditCard or ApplePay SDK components. For ApplePay use the SDK's native button and approved button type/styles. Other styling uses theme tokens. Add translated loading, pending, provider error, server verification error, conflict, retry and review-needed copy. Do not show raw provider errors as SDK/PAN-bearing diagnostics.
- [ ] On any callback, hide the payment form and reconcile stored paymentId; discard the raw SDK result after using it only as a trigger. On AppState active and explicit check-again, reconcile the same identity. If cancellation produces no callback, the user can check again/back; never lock the entire screen awaiting a callback that may not occur. Bounded polling checks server state, with no automatic initialization or second charge.
- [ ] Persist a client-owned pending identity before rendering a payable form. On remount initialize/reconcile against that same invoice, never blindly create a new booking/purchase. On logout/unmount stop timers and ignore stale responses from the previous client. Do not report COMPLETED as operational booking/purchase success until the corresponding authenticated resource is confirmed/active; requiresReview blocks success navigation.
- [ ] Add form/screen tests with a mocked SDK callback and fake timers: SDK paid + server pending stays pending; SDK failed + server completed uses server result; SDK result absent + foreground check works; stale client response ignored; merchant missing shows card option; native errors never call openAuthSessionAsync. Run only focused tests/type checks needed for this task.

**Deliverable:** Shared native screen can pay a server-owned invoice, with secure configuration, official components and safe reconciliation. Native capability module is build-tested; physical Apple Pay remains separately pending.

## Task 5: Wire every app entry and preserve resumption

**Files:** Modify features/booking/use-booking-payment.ts and tests; components/features/booking/PaymentMethods.tsx; app/(client)/booking/{payment.tsx,checkout.tsx,success.tsx}; features/booking/{use-payment-status.ts,use-existing-booking-checkout.ts,payment-resume-state.ts} only where native resumption differs; their existing tests. Modify lib/package-checkout.ts/tests, services/client/packages.ts/tests, hooks/queries/usePackages.ts, app/(client)/packages/{[id].tsx,return.tsx} and their tests.

**Interfaces:** Booking methods route to native-checkout with original bookingId/invoiceId/method after existing create/resume logic. Package native initialization uses its existing target/idempotency persistence, returns NativePackagePurchaseInitResponse and routes to native-checkout with purchaseId/invoiceId. SDK screen returns to the existing booking success or package return/status screen after reconciliation; cancel/back preserves identity for explicit resumption.

- [ ] Update existing test mocks from hosted result to native route/config. Assert no booking creation on retry/remount, no immediate success navigation, and selected Apple method preserved only while capability is available.

```ts
// Inside existing use-booking-payment tests, preserve its create/storage mocks.
await act(async () => { await result.current.pay(); });
expect(mockCreate).toHaveBeenCalledTimes(1);
expect(mockBrowser).not.toHaveBeenCalled();
expect(mockReplace).toHaveBeenCalledWith({
  pathname: '/(client)/payments/native-checkout',
  params: { invoiceId: 'invoice-1', bookingId: 'booking-1', method: 'ONLINE_CARD' },
});
```

- [ ] Change online paths to the shared native route. Do not touch at-center and bank-transfer branches. Remove generic fruit icon and change card label to translated «البطاقات»/«Cards» plus Mada/Visa/Mastercard. Apple availability comes from authenticated native config + built Merchant ID + PassKit, not generic moyasarEnabled. Guest still reaches login/registration before payment and resumes its original draft.
- [ ] Replace remaining-balance/group checkout browser action with native screen navigation; retain balance display from invoice and existing operational eligibility, and use focus-driven refresh after return. Remove hosted naming only where it actually obscures native eligibility; preserve compatibility exports until callers/tests move together.
- [ ] Package helper no longer opens a browser. Keep getPackagePurchaseAttemptKey and frozen target identity. Route both standalone/family purchase and package-return retry through native initialization. Do not clear attempt keys after SDK result; clear/renew only according to authenticated activated purchase state, including an old paid key returned by the API.
- [ ] Native dismissal must not use `abortedGatewayPhase` to label a pending charge failed after two checks. Pass an explicit native origin/verification signal or keep the native screen until the result is known. Existing hosted callback deep links from older app versions remain supported for reconciliation, but new mobile code never opens hosted checkout.
- [ ] Add tests for card/Mada, Apple unavailable on Android, wallet removed after initial display, bank transfer and at-center unaffected, guest draft preserved, duplicate taps, native init failure/remount, group expired hold, partial/deposit remaining balance, package target mismatch, and logout/client switch.
- [ ] Check source matches: `rg -n 'openAuthSessionAsync|checkout\.moyasar\.com' apps/mobile/features apps/mobile/lib apps/mobile/app`. Classify any retained callback/test strings; no production payment entry may invoke hosted checkout. Do not delete expo-web-browser if unrelated code still uses it.
- [ ] Run focused entry/resume/package tests. Review actual diff for every original hosted call site, including package retry path. No full-suite runs by delegated workers.

**Deliverable:** Every current mobile payment entry uses the same native screen and preserves booking/purchase identity. Website code/flow remains compatible.

## Task 6: Integrated verification, merchant readiness and release evidence

**Files:** Extend existing backend `test/e2e/finance/payment-reservation-concurrency.real-e2e-spec.ts` or add `native-payment-concurrency.real-e2e-spec.ts` for native/hosted overlap and shared settlement race. Update `docs/mobile-app/releases/2026-10-05-native-payments.md`, README.md, runbook.md for native rebuild/merchant config, and backend env/example operator notes. Evidence outside Git under `/Users/tariq/.codex/release-evidence/2026-10-05-mobile-native-moyasar/`, no credentials/customer data.

**Interfaces:** Existing local real-e2e fixture bootstrapping, Sandbox test keys in private files from earlier acceptance, and existing Moyasar webhook stage endpoint. Native acceptance uses the patched local backend; if remote staging deployment is not authorized, do not imply it contains new endpoints. A local HTTPS callback/approved test delivery must reach the patched backend for end-to-end webhook acceptance; verify network prerequisites before creating the test payment. No production transactions or billing scripts.

- [ ] Independent reviewer reads diff/spec/plan and checks contract coverage, exact gateway binding, financial concurrency, website defaults, privacy and native capability wiring. Use fresh `gpt-6-astra` high context with a local brief, explicit read-only ownership, no children, no broad checks. Address concrete findings before coordinator's integrated validation.
- [ ] Add real SQL race tests using existing synthetic fixture setup: concurrent native init creates one reservation/UUID; native vs hosted/bank-transfer yields one winner; webhook vs native reconcile emits one durable event and one payment; terminal booking gets one review request. Assert rollback on amount/currency mismatch. Do not point tests at live DB or remove real data.
- [ ] Coordinator runs shared build, backend typecheck/build and finance/API focused suites, mobile typecheck and full mobile suite, OpenAPI sync/diff and generated-dashboard typecheck. Run dashboard smoke once against healthy local test stack. Reuse prior test-only throttle-disabled backend pattern only locally if existing rate limits make fixture logins fail; never disable staging/production throttles. Use the existing test-command reference for real-e2e environment and capture exact command/results.
- [ ] Native iOS build from this worktree with SDK and local capability module; prove the binary includes them and its runtime points at the intended test API. If Android toolchain is available, native build/card rendering check there too; otherwise explicitly report unverified Android runtime rather than infer it from Jest. Verify Arabic/English, light/dark and keyboard behavior on card form.
- [ ] Read-only inspect existing Moyasar Apple certificate list and Apple Developer merchant/app capabilities using authenticated sessions or supported Apple tooling. If login is needed, open the exact page and request user login; never ask for passwords. Reuse a valid same-team merchant/certificate; otherwise prepare a separate Sawaa Merchant ID and Moyasar CSR without changing any existing shared merchant/certificate. Certificate or operator writes must stay inside the approved native setup scope; production runtime changes still require separate authorization.
- [ ] Enable native merchant configuration only after Merchant ID, processing certificate, app entitlement and provisioning match. Verify exported app entitlements and runtime merchant ID, not merely app.config text. Never fill config with an invented merchant ID or treat the public key as proof of Apple readiness.
- [ ] Actual Mada Sandbox test entered into the SDK in the app: official test card, managed 3DS, paid response, authoritative reconcile, one Payment COMPLETED and correct invoice/booking. Repeat a provider-declined test and cancellation/connection-interruption test while preserving the same pending attempt. Record the provider ID and internal states in private evidence; no PAN/CVC screenshots/logs in repo.
- [ ] Exercise one package self-purchase path and retry/activation using synthetic data; test family/grouped snapshot logic in handler coverage and runtime where a fixture exists. Verify credits created once. Compare the website hosted-init response and public tests after the patch; dashboard smoke must pass.
- [ ] Physical iPhone Apple Pay test after merchant readiness: official button → Apple sheet → payment → server confirmation, cancel and retry. A simulator build or a visible Apple button is insufficient. If the device is unavailable, retain this unchecked acceptance item and ask for the owner's physical test; do not claim complete Apple Pay verification.
- [ ] Update release docs with exact Git state, patch scope, native build/SDK version, test counts, actual environments and remaining unverified flows. Explain that service/price edits stay server-managed. Verify no secret keys, tokens or private certificate material were added to source/docs.
- [ ] Finish reviewable local patch. Present evidence and any blocker, then seek only the separately needed commit/push/staging/TestFlight permission under deployment policy; do not publish automatically. After all authorized implementation acceptance criteria are met, load finishing-a-development-branch and verification-before-completion, following owner boundaries rather than automatic commits.

## Execution handoff

The written spec is approved; this plan now requires owner review. Recommended method: Native execution with one independent Astra high review at the end, because shared state makes the implementation tasks sequential. If the owner chooses subagent-driven execution instead, follow that skill and exact file ownership, with coordinator-only integrated build/lint/full-suite verification. Neither method authorizes publishing.

## Coordinator verification commands

Run from the selected worktree; commands below are execution instructions, not results from this planning phase. For a new task's RED/GREEN, select its exact spec file rather than running all unrelated tests. After integration, run the broader required checks once.

```sh
pnpm --filter @sawaa/shared build
pnpm --filter=backend typecheck
pnpm --filter=backend test -- --runInBand src/modules/finance/native-payments src/modules/finance/moyasar-payment-settlement src/modules/finance/moyasar-webhook src/modules/finance/payments/client/init-client-payment src/modules/finance/package-purchases/init-package-purchase src/api/mobile/client/payments.controller.spec.ts src/api/mobile/client/package-purchase-init.http.spec.ts src/api/public/payments.controller.spec.ts
pnpm openapi:sync
pnpm --filter=dashboard typecheck
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test -- --runInBand
pnpm --filter=dashboard run e2e:smoke
```

For real PostgreSQL concurrency, use an isolated synthetic-fixture DB with `REAL_E2E_DATABASE_URL` and the existing real-e2e Jest config. Read the current backend test package script before choosing the exact invocation; require executed-test counts rather than accepting a describe.skip exit as evidence. Dashboard smoke uses the local API, with PW_API_URL set explicitly when using a separate test backend. Obtain database credentials from the private local environment without displaying them.

## Plan self-review

- Scope mapped: invoice/native contract Tasks 1–3; SDK/Apple capability Task 4; every existing hosted mobile entry/resume Task 5; website compatibility, SQL/provider/device acceptance and release docs Task 6.
- Review Focus mapped: timeout/404 Tasks 2–4; repricing/closure Tasks 2–3; cross-channel competition Tasks 3/6; missing Apple callback Task 4; account switching Tasks 4–5.
- Type names, service names and endpoint paths match the contract section. Website shared purchase response remains separate. Native caller has a mandatory reserved-payment match; webhook authentication is retained.
- Merchant readiness and physical-device access remain external prerequisites with explicit behavior when absent; there is no fabricated identifier or claimed device pass.
- Source changes required by the plan are not performed during plan review. No commit, deployment or provider-write action was taken in this phase.

## Official references used to check the plan

- Moyasar installation/basic integration/testing: https://docs.moyasar.com/sdk/react-native/installation ; https://docs.moyasar.com/sdk/react-native/basic-integration ; https://docs.moyasar.com/sdk/react-native/testing
- Public exports and Apple implementation inspected read-only: https://github.com/moyasar/moyasar-react-native/blob/main/src/index.tsx ; https://github.com/moyasar/moyasar-react-native/blob/main/src/views/apple_pay.tsx
- PassKit capability API: https://developer.apple.com/documentation/passkit/pkpaymentauthorizationcontroller/canmakepayments(usingnetworks:)
- Local Expo modules: https://docs.expo.dev/modules/get-started/

No command in this planning phase establishes SDK runtime success. Earlier hosted Mada acceptance is a baseline, not acceptance of this native implementation.
