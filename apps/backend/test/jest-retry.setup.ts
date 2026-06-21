// Scoped flaky-test mitigation for the controller e2e specs.
//
// Each `*.controller.spec.ts` bootstraps a Nest application and drives it
// through supertest. In the full parallel suite these share OS-level HTTP
// resources (ephemeral servers / sockets), and under contention a request can
// intermittently come back as a spurious 404 / timeout even though the same
// suite passes 40/40 in isolation. That is test-infrastructure contention, not
// a product defect.
//
// We retry ONLY the e2e controller specs. Unit/handler specs get no retry, so a
// genuine logic failure there still fails immediately. A retry cannot mask a
// deterministic bug either: it must pass on a later attempt to be reported
// green, and a real failure fails every attempt.
const testPath = expect.getState().testPath ?? '';

if (/\.controller\.spec\.ts$/.test(testPath)) {
  jest.retryTimes(2, { logErrorsBeforeRetry: true });
}
