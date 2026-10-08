# Native payment UI checks

These tests run the actual React Native screens and native card form on iOS,
against `fixture-api.py`, a local synthetic HTTP transport. It never forwards
requests to a backend or payment provider. No card payment is submitted.
Apple Pay is unavailable in this fixture; these checks do not establish provider,
3DS, authentication, receipt-upload, or physical-device acceptance.

## Prerequisites

- Xcode and an iOS Simulator named `Sawaa Booking QA`.
- A development build of `sa.sawa.app` with the current native payment modules
  installed on that simulator. Expo Go is insufficient.
- An existing synthetic CLIENT session in that disposable simulator. These
  tests do not sign in, verify tokens, or modify authentication behavior.
- Mobile dependencies installed and shared built from the checkout under test.
- Node satisfying the installed runner's engine requirement (`^22.22.3` or
  `>=24.8.0`), Python 3.9+, and `npm ci` in this directory.

## Run

From the repository root, start the fixture transport:

```sh
python3 e2e/mobile/fixture-api.py
```

In another terminal, start Metro from this checkout with the fixture URL:

```sh
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:59002/api/v1 pnpm exec expo start --port 8081 --localhost
```

Then, from `e2e/mobile`:

```sh
npm ci
npm test
```

The config launches the installed development app with Metro on port 8081.
Keep the fixture and Metro processes alive throughout the run. Verify Metro
serves this checkout, rather than another checkout on the same port. Each test
asserts the fixture's initialization/creation requests, so a different API
cannot satisfy its API assertions. Drafts, invoices, and package targets have
fresh identities to avoid interfering with saved payment attempts from an
earlier run. Tests intentionally preserve existing attempts in application
storage and never delete a user's session or payment recovery records.

The cases cover new booking card entry, an existing online invoice selected
for at-center payment, existing appointment checkout, package card entry,
bank-account/receipt screen entry, and fresh at-center confirmation. Package
entry asserts one initialization request; it does not prove purchase settlement.
The final case explicitly marks an invoice completed in the local fixture to
check navigation after success. That synthetic response does not establish a
provider charge, webhook, or real booking settlement.
Screenshots and the machine-readable report are written to `.e2e/`.

All actions and assertions are exact runner operations. No `agent.*` steps,
model provider, API key, or paid fallback are configured.

## Physical iPhone testing

Before installing a Release build, check its emitted Metro source map:

```sh
node e2e/mobile/verify-apple-pay-bundle.mjs /absolute/path/to/DerivedSources/main.jsbundle.map
```

This requires exactly one Moyasar `PKPaymentButton` registration module. Mixing
the SDK's `src` and `lib/module` imports crashes React Native before checkout;
component tests that mock the SDK cannot detect that bundle regression.

This simulator fixture is not the acceptance requested for the physical iPhone.
The installed build25 must be tested separately against its staging API. A
paired, unlocked device with Developer Mode enabled, a signed XCTest runner,
and macOS developer-tool access (`DevToolsSecurity`) are required. Never run
the simulator fixture suite against an installed staging/production build:
the fixture API assertions would fail and the app could use real server data.
