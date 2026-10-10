import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPlaywrightReport, assertE2eReport } from './premerge-local-results.mjs';

test('a zero-exit Playwright run cannot pass with skipped, flaky, or missing tests', () => {
  const result = { expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', errors: [] }] };
  const report = { stats: { expected: 2, skipped: 0, unexpected: 0, flaky: 0 }, errors: [],
    suites: [{ specs: [{ tests: [result] }], suites: [{ specs: [{ tests: [result] }] }] }] };
  assert.equal(assertPlaywrightReport(report), 2);
  for (const stats of [
    { ...report.stats, expected: 0 }, { ...report.stats, skipped: 1 },
    { ...report.stats, flaky: 1 }, { ...report.stats, unexpected: 1 },
  ]) assert.throws(() => assertPlaywrightReport({ ...report, stats }));
  assert.throws(() => assertPlaywrightReport({ ...report, errors: [{ message: 'setup failed' }] }));
  assert.throws(() => assertPlaywrightReport({ ...report, suites: [] }));
  assert.throws(() => assertPlaywrightReport({ ...report, stats: { ...report.stats, expected: 1 },
    suites: [{ specs: [{ tests: [{ ...result, expectedStatus: 'failed', results: [{ status: 'failed' }] }] }] }],
  }));
});

test('only intentionally filtered E2E tests can be omitted from acceptance', () => {
  const report = { run: { exitCode: 0, errors: [], results: [
    { selected: true, status: 'passed' },
    { selected: false, status: 'skipped', skip: { cause: 'filtered' } },
  ] } };
  assert.equal(assertE2eReport(report), 1);
  for (const status of ['skipped', 'flaky', 'failed', 'blocked', 'interrupted']) {
    const result = { selected: true, status, skip: { cause: 'explicit' } };
    assert.throws(() => assertE2eReport({ run: { ...report.run, results: [result] } }));
  }
  assert.throws(() => assertE2eReport({ run: { ...report.run, results: [report.run.results[1]] } }));
  assert.throws(() => assertE2eReport({ run: { ...report.run, exitCode: 1 } }));
});

test('E2E infrastructure errors cannot be hidden by otherwise passing tests', () => {
  assert.throws(() => assertE2eReport({ run: { exitCode: 0,
    errors: [{ code: 'MODEL_PROVIDER_FAILED' }], results: [{ selected: true, status: 'passed' }],
  } }));
});

test('malformed reports fail closed', () => {
  for (const report of [null, {}, { run: {} }, { stats: {} }]) {
    assert.throws(() => assertPlaywrightReport(report));
    assert.throws(() => assertE2eReport(report));
  }
});
