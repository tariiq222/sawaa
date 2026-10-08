# Deferred decorative asset request

The two key/remount attempts did not fix the fresh native host. Parent diagnostic logs show light render/request followed by dark render/request, then two onLoad events labeled dark with heights 1641 and 1622; 1622 matches the light asset. This fits the queued-response/native-recycling path identified in `aqua-rn-readonly-investigation.md`. Parent authorized preventing the initial asset request until stored theme mode settles.

Owned sources changed:
- `apps/mobile/theme/ThemeProvider.tsx`: add `isHydrated`, default context true and real provider initially false. Successful or rejected storage reads become ready only while active; existing mode selection, user override, storage writes, Appearance effect, and screen/provider rendering remain intact.
- `apps/mobile/theme/sawaa/AquaBackground.tsx`: gate image and light wash only when readiness is explicitly false. Semantic root background and content remain mounted. Missing flag remains compatible. Removed appearance keys and temporary Image/console diagnostic hooks.
- `apps/mobile/theme/__tests__/ThemeProvider.test.tsx`: integrated real-provider/backdrop deferred-dark test with content counter persistence; absent/invalid mode system fallback, rejected storage fallback, default-context readiness, existing preference toggles, and late user override assertions.
- `apps/mobile/theme/sawaa/__tests__/AquaBackground.test.tsx`: replace failed image/wrapper identity assertions with deferred-decoration tests for aqua and explicit-dark variants. Preserve light asset/wash styling, dark source transition, explicit-dark behavior, and compatibility with mocks lacking readiness.

Focused command:
```sh
pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath theme/__tests__/ThemeProvider.test.tsx theme/sawaa/__tests__/AquaBackground.test.tsx
```
RED: exit 1, 8 failed / 4 passed, 2 failed suites (`aqua-hydration-before.log`), failures on missing readiness and premature ImageBackground mounting.
GREEN: exit 0, 12 passed / 12 total, 2 passed suites, 0.933s (`aqua-hydration-after.log`), no warnings/errors.

Jest proves asset-request gating and state preservation; native pixel confirmation and final integrated review/checks remain with the parent. No full suite/typecheck/lint/build/commit or source beyond the four owned files changed in this follow-up.
