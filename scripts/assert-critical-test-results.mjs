#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

function usageError(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { required: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--results') {
      options.results = argv[++index];
    } else if (arg === '--required') {
      const value = argv[++index];
      if (!value) usageError('--required needs a path');
      options.required.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
    } else if (arg === '--exit-code') {
      options.exitCode = argv[++index];
    } else if (arg === '--exit-code-file') {
      options.exitCodeFile = argv[++index];
    } else if (arg === '--validate-real-e2e-database-url') {
      options.validateRealE2eDatabaseUrl = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: assert-critical-test-results.mjs --results <jest.json> --exit-code <code> --required <path> [--required <path>]');
      process.exit(0);
    } else {
      usageError(`unknown argument: ${arg}`);
    }
  }

  if (options.validateRealE2eDatabaseUrl) return options;
  if (!options.results) usageError('--results is required');
  if (!options.required.length) usageError('at least one --required path is required');
  if (options.exitCode === undefined && options.exitCodeFile === undefined) {
    usageError('explicit --exit-code or --exit-code-file evidence is required');
  }
  if (options.exitCode !== undefined && options.exitCodeFile !== undefined) {
    usageError('provide only one of --exit-code or --exit-code-file');
  }
  return options;
}

export function assertSafeRealE2eDatabaseUrl(value = process.env.REAL_E2E_DATABASE_URL) {
  if (!value?.trim()) usageError('REAL_E2E_DATABASE_URL is required for the critical real-database lane');

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    usageError('REAL_E2E_DATABASE_URL must be a valid PostgreSQL URL');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const target = `${parsed.hostname} ${databaseName}`.toLowerCase();
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    usageError('REAL_E2E_DATABASE_URL must use the PostgreSQL protocol');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    usageError('REAL_E2E_DATABASE_URL must target a local test database');
  }
  if (/(prod|production|staging|stage|dev|development)/i.test(target)) {
    usageError('REAL_E2E_DATABASE_URL target contains an unsafe environment marker');
  }
  if (!/(test|e2e|sawaa_test)/i.test(databaseName)) {
    usageError('REAL_E2E_DATABASE_URL database name must contain a test marker');
  }
}

function normalizePath(value) {
  const normalized = String(value).replaceAll('\\', '/');
  return normalized.startsWith('/')
    ? normalized
    : resolve(process.cwd(), normalized).replaceAll(sep, '/');
}

function readExitCode(options) {
  const raw = options.exitCodeFile === undefined
    ? options.exitCode
    : readFileSync(resolve(process.cwd(), options.exitCodeFile), 'utf8').trim();
  if (raw === undefined || !/^-?\d+$/.test(raw)) {
    usageError('exit code evidence must be an integer');
  }
  return Number(raw);
}

function readReport(resultsPath) {
  const path = resolve(process.cwd(), resultsPath);
  if (!existsSync(path)) usageError(`Jest results file is missing: ${resultsPath}`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    usageError(`Jest results JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    usageError('Jest results JSON must be an object');
  }
  return parsed;
}

function assertReport(report, requiredPaths, exitCode) {
  const failures = [];
  if (exitCode !== 0) failures.push(`Jest command exit code was ${exitCode}; expected 0`);
  if (report.success !== true) failures.push('Jest report success evidence is absent or false');
  if (!Number.isInteger(report.numFailedTests) || report.numFailedTests !== 0) {
    failures.push(`Jest report has ${report.numFailedTests ?? 'unknown'} failed tests`);
  }
  if (!Number.isInteger(report.numPendingTests) || report.numPendingTests !== 0) {
    failures.push(`Jest report has ${report.numPendingTests ?? 'unknown'} pending tests`);
  }
  if (!Array.isArray(report.testResults)) failures.push('Jest report testResults is missing or invalid');

  const suites = Array.isArray(report.testResults) ? report.testResults : [];
  const byPath = new Map(suites.map((suite) => [normalizePath(suite?.name ?? suite?.testFilePath ?? ''), suite]));
  for (const requiredPath of requiredPaths) {
    const absolutePath = resolve(process.cwd(), requiredPath);
    if (!existsSync(absolutePath)) {
      failures.push(`required test path is missing from this worktree: ${requiredPath}`);
      continue;
    }
    const suite = byPath.get(normalizePath(requiredPath));
    if (!suite) {
      failures.push(`required test path is absent from Jest results: ${requiredPath}`);
      continue;
    }
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
    if (assertions.length === 0) failures.push(`required test path has zero tests: ${requiredPath}`);
    const unsafeAssertions = assertions.filter((assertion) => ['pending', 'todo', 'skipped'].includes(assertion?.status));
    if (suite.status === 'skipped' || unsafeAssertions.length > 0) {
      failures.push(`required test path contains skipped or pending tests: ${requiredPath}`);
    }
  }

  const pendingAssertions = suites.flatMap((suite) => Array.isArray(suite?.assertionResults) ? suite.assertionResults : [])
    .filter((assertion) => ['pending', 'todo', 'skipped'].includes(assertion?.status));
  if (pendingAssertions.length > 0 && !failures.some((failure) => failure.includes('pending tests'))) {
    failures.push(`Jest assertion results contain ${pendingAssertions.length} pending or skipped tests`);
  }

  if (failures.length > 0) throw new Error(failures.join('; '));
  return { suites: suites.length, tests: Number.isInteger(report.numTotalTests) ? report.numTotalTests : 0 };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.validateRealE2eDatabaseUrl) {
      assertSafeRealE2eDatabaseUrl();
      console.log('critical real-database URL: PASS');
      return;
    }
    const exitCode = readExitCode(options);
    const report = readReport(options.results);
    const summary = assertReport(report, options.required, exitCode);
    console.log(`critical test results: PASS (${summary.suites} suites, ${summary.tests} tests)`);
  } catch (error) {
    console.error(`critical test results: FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
