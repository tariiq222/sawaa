import assert from 'node:assert/strict';

export function assertPlaywrightReport(report, requiredProjects = ['website', 'dashboard']) {
  const stats = report?.stats;
  assert.ok(stats && Number.isInteger(stats.expected) && stats.expected > 0,
    'Playwright must execute at least one passing test');
  for (const key of ['skipped', 'unexpected', 'flaky']) {
    assert.equal(stats[key], 0, `Playwright ${key} tests block local acceptance`);
  }
  assert.ok(Array.isArray(report.errors) && report.errors.length === 0,
    'Playwright infrastructure errors block local acceptance');
  const tests = [];
  function visit(suites) {
    assert.ok(Array.isArray(suites), 'Playwright report must contain executed test suites');
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        assert.ok(Array.isArray(spec.tests), 'Invalid Playwright test results');
        tests.push(...spec.tests);
      }
      if (suite.suites) visit(suite.suites);
    }
  }
  visit(report.suites);
  assert.equal(tests.length, stats.expected, 'Missing executed Playwright test results');
  for (const test of tests) {
    assert.equal(test.expectedStatus, 'passed', 'Expected failures block local acceptance');
    assert.equal(test.status, 'expected', 'Every Playwright test must pass');
    assert.ok(Array.isArray(test.results) && test.results.length === 1
      && test.results[0].status === 'passed' && Array.isArray(test.results[0].errors)
      && test.results[0].errors.length === 0, 'Every Playwright test must pass without retries or errors');
  }
  const projects = new Set(tests.map(test => test.projectName));
  for (const project of requiredProjects) {
    assert.ok(projects.has(project), `Playwright project ${project} ran no tests`);
  }
  return stats.expected;
}

export function assertE2eReport(report) {
  const run = report?.run;
  assert.ok(run && run.exitCode === 0 && Array.isArray(run.results), 'Invalid or failed E2E report');
  assert.ok(Array.isArray(run.errors) && run.errors.length === 0,
    'E2E infrastructure errors block local acceptance');
  const selected = run.results.filter(result => !(result.selected === false
    && result.status === 'skipped' && result.skip?.cause === 'filtered'));
  assert.ok(selected.length > 0, 'E2E must execute at least one selected test');
  for (const result of selected) {
    assert.equal(result.selected, true, 'An unselected non-filtered result blocks acceptance');
    assert.equal(result.status, 'passed', `E2E ${result.status} result blocks local acceptance`);
  }
  return selected.length;
}
