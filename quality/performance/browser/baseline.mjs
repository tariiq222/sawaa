#!/usr/bin/env node
/**
 * Independent Playwright lab baseline for the public website and dashboard.
 *
 * Uses @playwright/test installed in apps/dashboard. Does not modify app
 * Playwright config. Does not enforce SLOs.
 *
 * From repo root:
 *   node quality/performance/browser/baseline.mjs
 *   node quality/performance/browser/baseline.mjs --help
 *   node quality/performance/browser/baseline.mjs --self-test
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SCHEMA_VERSION = 1;
const TOOL_ID = 'quality/performance/browser/baseline.mjs';
const DEFAULT_WAIT_MS = 5000;
const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const MAX_EVENT_ROWS = 50;
const CLS_GAP_MS = 1000;
const CLS_WINDOW_MS = 5000;
const ID_MARK = ':id';
const REDACTED_JWT = '[redacted-jwt]';
const BLOCKED_REDIRECT_MESSAGE =
  'Remote guard: blocked unauthorized redirect target.';
const DEFAULT_URLS = Object.freeze([
  'http://localhost:5205/',
  'http://localhost:5203/',
]);
const INP_REASON =
  'INP requires user interaction. This lab baseline only navigates and observes; it does not click or type, so INP is unsupported and always null.';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d+$/;
const HEX_OPAQUE_RE = /^[0-9a-f]{16,}$/i;
const MIXED_OPAQUE_RE = /^[A-Za-z0-9_-]{16,}$/;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const EMBEDDED_URL_RE = /https?:\/\/[^\s"'<>]+/gi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DASHBOARD_PKG = path.join(REPO_ROOT, 'apps/dashboard/package.json');

function printHelp() {
  process.stdout.write(`Usage:
  node quality/performance/browser/baseline.mjs [options]

Lab navigation baseline for the public website (:5205) and dashboard (:5203).
Resolves Playwright from apps/dashboard (no app config changes).
Does not enforce SLOs. Nonzero exit is reserved for operational/guard errors.

Options:
  --help, -h              Show this help and exit 0
  --self-test             Read-only guard/redaction/CLS/determinism tests (no browser)
  --urls <json-or-csv>    Override target URLs
  --output <path>         Write JSON report (else stdout)
  --storage-state <path>  Playwright storageState JSON for dashboard auth
  --wait-ms <n>           Observe window after load (default ${DEFAULT_WAIT_MS})
  --timeout-ms <n>        Navigation timeout (default ${DEFAULT_NAV_TIMEOUT_MS})
  --confirm-remote        Required with staging for non-local URLs

Environment:
  PERF_URLS               JSON array or CSV of URLs
  PERF_OUTPUT             Output JSON path
  PERF_STORAGE_STATE      storageState path
  PERF_WAIT_MS            Observe window after load
  PERF_NAV_TIMEOUT_MS     Navigation timeout
  PERF_CONFIRM_REMOTE=1   Explicit confirmation for staging remotes
  PERF_ENV=staging        Declare staging when targeting a remote staging host

Defaults (local only):
  ${DEFAULT_URLS.join('\n  ')}

Remote guard:
  Local hosts only by default (localhost, 127.0.0.1, ::1, *.localhost).
  Hosts/labels "prod" or "production" are always rejected.
  Other remotes require staging (PERF_ENV=staging or a staging hostname)
  AND explicit confirmation (--confirm-remote or PERF_CONFIRM_REMOTE=1).
  Navigation and redirect targets are checked before the request is sent.
  Unauthorized production/remote redirect targets abort as operational failures.

JSON schema (schemaVersion ${SCHEMA_VERSION}):
  metadata   safe run info (no cookies, tokens, headers, or storageState)
  notes      INP unsupported + no SLO gate
  pages[]    per-URL metrics, network counts, console errors

INP is always null/unsupported. Do not treat this file as a field RUM report.
`);
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    help: false,
    selfTest: false,
    urlsRaw: null,
    output: null,
    storageState: null,
    waitMs: null,
    timeoutMs: null,
    confirmRemote: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--self-test') {
      args.selfTest = true;
      continue;
    }
    if (token === '--confirm-remote') {
      args.confirmRemote = true;
      continue;
    }
    const next = argv[i + 1];
    const take = (name) => {
      if (next == null || next.startsWith('--')) {
        throw new Error(`Missing value for ${name}`);
      }
      i += 1;
      return next;
    };
    if (token === '--urls') {
      args.urlsRaw = take('--urls');
      continue;
    }
    if (token === '--output') {
      args.output = take('--output');
      continue;
    }
    if (token === '--storage-state') {
      args.storageState = take('--storage-state');
      continue;
    }
    if (token === '--wait-ms') {
      args.waitMs = take('--wait-ms');
      continue;
    }
    if (token === '--timeout-ms') {
      args.timeoutMs = take('--timeout-ms');
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function envFlag(name) {
  const value = process.env[name];
  if (value == null || value === '') return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function parseInteger(raw, label, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return n;
}

function parseUrlList(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`PERF_URLS / --urls JSON is invalid: ${error.message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('PERF_URLS / --urls JSON must be an array of URL strings');
    }
    return parsed.map((item, index) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw new Error(`URL at index ${index} must be a non-empty string`);
      }
      return item.trim();
    });
  }
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol (http/https only)');
  }
  return parsed.href;
}

function hostnameOf(url) {
  return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  );
}

function labelsOf(hostname) {
  return hostname.split('.').filter(Boolean);
}

function isProductionHost(hostname) {
  return labelsOf(hostname).some(
    (label) =>
      label === 'prod' ||
      label === 'production' ||
      label.endsWith('-prod') ||
      label.endsWith('-production'),
  );
}

function isStagingHost(hostname) {
  return labelsOf(hostname).some(
    (label) => label === 'staging' || label.endsWith('-staging'),
  );
}

function declaredEnv() {
  return String(process.env.PERF_ENV || '').trim().toLowerCase();
}

function assertRemoteGuard(urls, confirmRemote) {
  const env = declaredEnv();
  if (env === 'prod' || env === 'production') {
    throw new Error(
      'Remote guard: PERF_ENV=prod/production is rejected. This tool defaults to local lab URLs only.',
    );
  }

  for (const url of urls) {
    const hostname = hostnameOf(url);
    if (isLocalHostname(hostname)) continue;
    if (isProductionHost(hostname)) {
      throw new Error(
        'Remote guard: production host rejected. Defaults are local-only; prod/production is never allowed.',
      );
    }
    const staging = env === 'staging' || isStagingHost(hostname);
    if (!staging) {
      throw new Error(
        'Remote guard: host is not local. Non-local URLs require staging (PERF_ENV=staging or a staging hostname) and --confirm-remote / PERF_CONFIRM_REMOTE=1.',
      );
    }
    if (!confirmRemote) {
      throw new Error(
        'Remote guard: staging remote requires explicit confirmation (--confirm-remote or PERF_CONFIRM_REMOTE=1).',
      );
    }
  }
}

function isOpaqueIdSegment(segment) {
  if (UUID_RE.test(segment) || NUMERIC_ID_RE.test(segment)) return true;
  if (segment.length < 16) return false;
  if (HEX_OPAQUE_RE.test(segment)) return true;
  return MIXED_OPAQUE_RE.test(segment) && /[A-Za-z]/.test(segment) && /\d/.test(segment);
}

function sanitizePathname(pathname) {
  return String(pathname || '/')
    .split('/')
    .map((segment) => (segment && isOpaqueIdSegment(segment) ? ID_MARK : segment))
    .join('/');
}

function publicUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${sanitizePathname(parsed.pathname)}`;
  } catch {
    return '[unparseable-url]';
  }
}

function sanitizeEmbeddedUrl(match) {
  const trimmed = String(match).replace(/[),.;]+$/g, '');
  return publicUrl(trimmed);
}

function sanitizeText(text) {
  let value = String(text ?? '');
  value = value.replace(EMBEDDED_URL_RE, sanitizeEmbeddedUrl);
  value = value.replace(JWT_RE, REDACTED_JWT);
  value = value.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  value = value.replace(
    /(authorization|cookie|set-cookie|token|secret|password)\s*[:=]\s*\S+/gi,
    '$1=[redacted]',
  );
  if (value.length > 240) value = `${value.slice(0, 237)}...`;
  return value;
}

function isHttpUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isUrlAllowed(url, confirmRemote) {
  try {
    assertRemoteGuard([normalizeUrl(url)], confirmRemote);
    return true;
  } catch {
    return false;
  }
}

function roundMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

function roundCls(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 1e6) / 1e6;
}

function clsSessionWindow(entries) {
  const list = [...(entries || [])]
    .filter((entry) => entry && entry.hadRecentInput !== true)
    .sort((a, b) => a.startTime - b.startTime || a.value - b.value);

  let sessionValue = 0;
  let sessionStart = null;
  let lastTime = null;
  let maxValue = 0;

  for (const entry of list) {
    const t = entry.startTime;
    const v = typeof entry.value === 'number' ? entry.value : 0;
    if (
      lastTime != null &&
      sessionStart != null &&
      t - lastTime <= CLS_GAP_MS &&
      t - sessionStart <= CLS_WINDOW_MS
    ) {
      sessionValue += v;
    } else {
      sessionValue = v;
      sessionStart = t;
    }
    lastTime = t;
    if (sessionValue > maxValue) maxValue = sessionValue;
  }

  return maxValue;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function eventRowKey(row) {
  if (!row || typeof row !== 'object') return String(row ?? '');
  return Object.keys(row)
    .sort()
    .map((key) => `${key}=${row[key] ?? ''}`)
    .join('|');
}

function capRows(rows) {
  const list = [...rows].sort((a, b) => eventRowKey(a).localeCompare(eventRowKey(b)));
  return {
    items: list.slice(0, MAX_EVENT_ROWS),
    truncated: rows.length > MAX_EVENT_ROWS,
    collected: rows.length,
  };
}

function loadPlaywright() {
  if (!fs.existsSync(DASHBOARD_PKG)) {
    throw new Error(`Dashboard package.json not found at ${path.relative(process.cwd(), DASHBOARD_PKG)}`);
  }
  const dashboardRequire = createRequire(DASHBOARD_PKG);
  let playwright;
  try {
    playwright = dashboardRequire('@playwright/test');
  } catch (error) {
    throw new Error(
      `Unable to resolve @playwright/test from apps/dashboard. Install workspace deps, then browsers via: pnpm --filter=dashboard run e2e:install\n${error.message}`,
    );
  }
  const { chromium } = playwright;
  if (!chromium) {
    throw new Error('@playwright/test did not export chromium');
  }
  let version = 'unknown';
  try {
    version = dashboardRequire('@playwright/test/package.json').version || 'unknown';
  } catch {
    version = 'unknown';
  }
  return { chromium, version };
}

const INIT_OBSERVER_SCRIPT = `(() => {
  window.__perfBaseline = {
    lcp: null,
    cls: 0,
    fcp: null,
    clsSessionValue: 0,
    clsSessionStart: null,
    clsLastStart: null,
    observersReady: false,
    observerError: null,
  };
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__perfBaseline.lcp = last.startTime;
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

    const clsGapMs = ${CLS_GAP_MS};
    const clsWindowMs = ${CLS_WINDOW_MS};
    const clsObs = new PerformanceObserver((list) => {
      const b = window.__perfBaseline;
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const t = entry.startTime;
        if (
          b.clsLastStart != null &&
          b.clsSessionStart != null &&
          t - b.clsLastStart <= clsGapMs &&
          t - b.clsSessionStart <= clsWindowMs
        ) {
          b.clsSessionValue += entry.value;
        } else {
          b.clsSessionValue = entry.value;
          b.clsSessionStart = t;
        }
        b.clsLastStart = t;
        if (b.clsSessionValue > b.cls) b.cls = b.clsSessionValue;
      }
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });

    const paintObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          window.__perfBaseline.fcp = entry.startTime;
        }
      }
    });
    paintObs.observe({ type: 'paint', buffered: true });

    window.__perfBaseline.observersReady = true;
  } catch (error) {
    window.__perfBaseline.observerError = String(error && error.message ? error.message : error);
  }
})()`;

async function readPageMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || null;
    const paints = performance.getEntriesByType('paint') || [];
    const resources = performance.getEntriesByType('resource') || [];
    const baseline = window.__perfBaseline || {};
    const fcpPaint = paints.find((entry) => entry.name === 'first-contentful-paint');
    let transferSizeBytes = 0;
    let transferKnown = false;
    if (nav && typeof nav.transferSize === 'number') {
      transferSizeBytes += nav.transferSize;
      transferKnown = true;
    }
    for (const resource of resources) {
      if (typeof resource.transferSize === 'number') {
        transferSizeBytes += resource.transferSize;
        transferKnown = true;
      }
    }
    return {
      observersReady: Boolean(baseline.observersReady),
      observerError: baseline.observerError || null,
      ttfbMs: nav ? nav.responseStart : null,
      fcpMs: baseline.fcp ?? (fcpPaint ? fcpPaint.startTime : null),
      lcpMs: baseline.lcp ?? null,
      cls: typeof baseline.cls === 'number' ? baseline.cls : null,
      navigationDurationMs: nav ? nav.duration : null,
      resourceCount: resources.length + (nav ? 1 : 0),
      transferSizeBytes: transferKnown ? transferSizeBytes : null,
      transferSizeSource: transferKnown ? 'performance-resource-timing' : null,
    };
  });
}

async function measurePage(context, url, waitMs, timeoutMs, confirmRemote) {
  const page = await context.newPage();
  const requests = [];
  const failedRequests = [];
  const httpErrors = [];
  const consoleErrors = [];
  let redirectBlocked = false;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = request.url();
    const mustGuard =
      isHttpUrl(requestUrl) &&
      (request.isNavigationRequest() || request.redirectedFrom() != null);
    if (mustGuard && !isUrlAllowed(requestUrl, confirmRemote)) {
      redirectBlocked = true;
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  page.on('request', (request) => {
    requests.push(request.url());
  });
  page.on('requestfailed', (request) => {
    const requestUrl = request.url();
    const wasGuarded =
      isHttpUrl(requestUrl) &&
      (request.isNavigationRequest() || request.redirectedFrom() != null);
    if (wasGuarded && !isUrlAllowed(requestUrl, confirmRemote)) {
      return;
    }
    failedRequests.push({
      url: publicUrl(requestUrl),
      errorText: sanitizeText(request.failure()?.errorText || 'requestfailed'),
    });
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      httpErrors.push({
        url: publicUrl(response.url()),
        status,
      });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({
        type: 'error',
        text: sanitizeText(message.text()),
      });
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push({
      type: 'pageerror',
      text: sanitizeText(error && error.message ? error.message : error),
    });
  });

  let operationalError = null;
  let mainStatus = null;
  let mainOk = null;
  let finalUrl = publicUrl(url);

  try {
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: timeoutMs,
    });
    if (redirectBlocked) {
      throw new Error(BLOCKED_REDIRECT_MESSAGE);
    }
    mainStatus = response ? response.status() : null;
    mainOk = response ? response.ok() : null;
    finalUrl = publicUrl(page.url());
    if (!isUrlAllowed(page.url(), confirmRemote)) {
      redirectBlocked = true;
      throw new Error(BLOCKED_REDIRECT_MESSAGE);
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const raw = await readPageMetrics(page);
    const failed = capRows(failedRequests);
    const http = capRows(httpErrors);
    const consoles = capRows(consoleErrors);

    return {
      operationalError: null,
      page: {
        url: publicUrl(url),
        finalUrl,
        mainDocumentStatus: mainStatus,
        mainDocumentOk: mainOk,
        metrics: {
          ttfbMs: roundMs(raw.ttfbMs),
          fcpMs: roundMs(raw.fcpMs),
          lcpMs: roundMs(raw.lcpMs),
          cls: roundCls(raw.cls),
          inpMs: null,
          inpStatus: 'unsupported',
          inpReason: INP_REASON,
          navigationDurationMs: roundMs(raw.navigationDurationMs),
          observersReady: raw.observersReady,
          observerError: raw.observerError,
        },
        network: {
          requestCount: requests.length,
          resourceCount: raw.resourceCount,
          transferSizeBytes: raw.transferSizeBytes,
          transferSizeSource: raw.transferSizeSource,
          failedRequestCount: failed.collected,
          failedRequests: failed.items,
          failedRequestsTruncated: failed.truncated,
          httpErrorCount: http.collected,
          httpErrors: http.items,
          httpErrorsTruncated: http.truncated,
        },
        console: {
          errorCount: consoles.collected,
          errors: consoles.items,
          errorsTruncated: consoles.truncated,
        },
        error: null,
      },
    };
  } catch (error) {
    operationalError = redirectBlocked
      ? BLOCKED_REDIRECT_MESSAGE
      : sanitizeText(error && error.message ? error.message : error);
    return {
      operationalError,
      page: {
        url: publicUrl(url),
        finalUrl,
        mainDocumentStatus: mainStatus,
        mainDocumentOk: mainOk,
        metrics: {
          ttfbMs: null,
          fcpMs: null,
          lcpMs: null,
          cls: null,
          inpMs: null,
          inpStatus: 'unsupported',
          inpReason: INP_REASON,
          navigationDurationMs: null,
          observersReady: false,
          observerError: null,
        },
        network: {
          requestCount: requests.length,
          resourceCount: null,
          transferSizeBytes: null,
          transferSizeSource: null,
          failedRequestCount: failedRequests.length,
          failedRequests: capRows(failedRequests).items,
          failedRequestsTruncated: failedRequests.length > MAX_EVENT_ROWS,
          httpErrorCount: httpErrors.length,
          httpErrors: capRows(httpErrors).items,
          httpErrorsTruncated: httpErrors.length > MAX_EVENT_ROWS,
        },
        console: {
          errorCount: consoleErrors.length,
          errors: capRows(consoleErrors).items,
          errorsTruncated: consoleErrors.length > MAX_EVENT_ROWS,
        },
        error: operationalError,
      },
    };
  } finally {
    await page.close().catch(() => {});
  }
}

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function containsSensitive(value) {
  const text = String(value ?? '');
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    return true;
  }
  if (text.includes('?') || text.includes('#')) return true;
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) return true;
  if (/eyJ[A-Za-z0-9_-]{8,}/.test(text)) return true;
  return false;
}

function runSelfTests() {
  const failures = [];
  const assert = (name, condition) => {
    if (!condition) failures.push(name);
  };

  withEnv({ PERF_ENV: '' }, () => {
    assert('guard-http-only', isHttpUrl('http://localhost:5205/') && !isHttpUrl('about:blank'));
    assert('guard-allow-local', isUrlAllowed('http://localhost:5205/', false));
    assert('guard-reject-production', !isUrlAllowed('https://prod.example.com/', false));
    assert(
      'guard-reject-production-label',
      !isUrlAllowed('https://api-production.example.com/', true),
    );
    assert('guard-reject-remote', !isUrlAllowed('https://example.com/', false));
    assert(
      'guard-reject-staging-unconfirmed',
      !isUrlAllowed('https://staging.example.com/', false),
    );
    assert(
      'guard-allow-staging-confirmed',
      isUrlAllowed('https://staging.example.com/', true),
    );
  });

  withEnv({ PERF_ENV: 'production' }, () => {
    assert('guard-reject-perf-env-production', !isUrlAllowed('http://localhost:5205/', false));
  });

  withEnv({ PERF_ENV: 'staging' }, () => {
    assert(
      'guard-reject-staging-env-unconfirmed',
      !isUrlAllowed('https://lab.example.com/', false),
    );
    assert(
      'guard-allow-staging-env-confirmed',
      isUrlAllowed('https://lab.example.com/', true),
    );
  });

  const sampleUuid = '550e8400-e29b-41d4-a716-446655440000';
  const sampleJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const opaque = `tok${'a1'.repeat(12)}`;
  const dirty = `https://localhost:5203/users/${sampleUuid}/files/${opaque}/42?token=${sampleJwt}&x=1#frag`;
  const sanitizedUrl = publicUrl(dirty);

  assert('url-strips-query', !sanitizedUrl.includes('?'));
  assert('url-strips-hash', !sanitizedUrl.includes('#'));
  assert('url-redacts-uuid', !sanitizedUrl.includes(sampleUuid) && sanitizedUrl.includes(ID_MARK));
  assert('url-redacts-numeric', sanitizedUrl.includes(`/${ID_MARK}`) && !sanitizedUrl.endsWith('/42'));
  assert('url-redacts-opaque', !sanitizedUrl.includes(opaque));
  assert('url-keeps-origin-path', sanitizedUrl.startsWith('https://localhost:5203/users/'));

  const dirtyText =
    `failed ${dirty} Authorization: Bearer ${sampleJwt} cookie=abc123 token=${sampleJwt} secret=shh`;
  const sanitizedText = sanitizeText(dirtyText);
  assert('text-redacts-uuid', !sanitizedText.includes(sampleUuid));
  assert('text-redacts-jwt', !sanitizedText.includes(sampleJwt) && !sanitizedText.includes('eyJ'));
  assert('text-redacts-query', !sanitizedText.includes('?'));
  assert('text-redacts-cookie', !sanitizedText.includes('abc123'));
  assert('text-redacts-secret', !sanitizedText.includes('shh'));
  assert(
    'text-keeps-redaction-markers',
    sanitizedText.includes(REDACTED_JWT) || sanitizedText.includes('[redacted]'),
  );

  const rows = [];
  for (let i = 0; i < 60; i += 1) {
    rows.push({
      url: `http://localhost/${String.fromCharCode(122 - (i % 26))}`,
      status: 500 - (i % 3),
      errorText: `e${i % 7}`,
    });
  }
  const cappedA = capRows(rows);
  const cappedB = capRows([...rows].reverse());
  assert('cap-sort-stable', JSON.stringify(cappedA.items) === JSON.stringify(cappedB.items));
  assert('cap-max-rows', cappedA.items.length === MAX_EVENT_ROWS);
  assert(
    'cap-sort-before-slice',
    JSON.stringify(cappedA.items) !== JSON.stringify(rows.slice(0, MAX_EVENT_ROWS)),
  );
  assert('cap-truncated', cappedA.truncated === true && cappedA.collected === 60);

  const clsMax = clsSessionWindow([
    { startTime: 0, value: 0.1, hadRecentInput: false },
    { startTime: 400, value: 0.2, hadRecentInput: false },
    { startTime: 1800, value: 0.05, hadRecentInput: false },
    { startTime: 2200, value: 0.04, hadRecentInput: false },
  ]);
  assert('cls-max-session-window', roundCls(clsMax) === 0.3);

  const clsGap = clsSessionWindow([
    { startTime: 0, value: 0.1, hadRecentInput: false },
    { startTime: 1000, value: 0.2, hadRecentInput: false },
  ]);
  assert('cls-gap-inclusive', roundCls(clsGap) === 0.3);

  const clsWindow = clsSessionWindow([
    { startTime: 0, value: 0.1, hadRecentInput: false },
    { startTime: 1000, value: 0.1, hadRecentInput: false },
    { startTime: 2000, value: 0.1, hadRecentInput: false },
    { startTime: 3000, value: 0.1, hadRecentInput: false },
    { startTime: 4000, value: 0.1, hadRecentInput: false },
    { startTime: 5000, value: 0.1, hadRecentInput: false },
    { startTime: 5001, value: 0.4, hadRecentInput: false },
  ]);
  assert('cls-window-inclusive-then-split', roundCls(clsWindow) === 0.6);

  const clsIgnore = clsSessionWindow([
    { startTime: 0, value: 0.9, hadRecentInput: true },
    { startTime: 10, value: 0.11, hadRecentInput: false },
  ]);
  assert('cls-ignores-recent-input', roundCls(clsIgnore) === 0.11);

  const outputs = [sanitizedUrl, sanitizedText, BLOCKED_REDIRECT_MESSAGE, ...failures];
  assert(
    'outputs-have-no-secrets',
    outputs.every((item) => !containsSensitive(item)),
  );

  if (failures.length) {
    process.stderr.write(`self-test failed: ${failures.join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('self-test ok\n');
  process.exit(0);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.selfTest) {
    runSelfTests();
    return;
  }

  let urls;
  let urlSource = 'default';
  let waitMs;
  let timeoutMs;
  let outputPath;
  let storageStatePath;
  const confirmRemote = args.confirmRemote || envFlag('PERF_CONFIRM_REMOTE');

  try {
    const urlsRaw = args.urlsRaw ?? process.env.PERF_URLS ?? null;
    if (urlsRaw) {
      urlSource = args.urlsRaw ? 'cli' : 'env';
      urls = parseUrlList(urlsRaw).map(normalizeUrl);
    } else {
      urls = DEFAULT_URLS.map(normalizeUrl);
    }
    if (urls.length === 0) {
      throw new Error('No URLs to measure');
    }
    waitMs = parseInteger(args.waitMs ?? process.env.PERF_WAIT_MS, 'wait-ms', DEFAULT_WAIT_MS);
    timeoutMs = parseInteger(
      args.timeoutMs ?? process.env.PERF_NAV_TIMEOUT_MS,
      'timeout-ms',
      DEFAULT_NAV_TIMEOUT_MS,
    );
    outputPath = args.output ?? process.env.PERF_OUTPUT ?? null;
    storageStatePath = args.storageState ?? process.env.PERF_STORAGE_STATE ?? null;
    assertRemoteGuard(urls, confirmRemote);
  } catch (error) {
    fail(error.message);
  }

  if (storageStatePath) {
    const resolved = path.resolve(storageStatePath);
    if (!fs.existsSync(resolved)) {
      fail(`storageState file not found: ${storageStatePath}`);
    }
    storageStatePath = resolved;
  }

  let chromium;
  let playwrightVersion;
  try {
    ({ chromium, version: playwrightVersion } = loadPlaywright());
  } catch (error) {
    fail(error.message);
  }

  const generatedAt = new Date().toISOString();
  const pages = [];
  let operationalFailure = false;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const contextOptions = {
      viewport: DEFAULT_VIEWPORT,
      locale: 'ar-SA',
      timezoneId: 'Asia/Riyadh',
    };
    if (storageStatePath) {
      contextOptions.storageState = storageStatePath;
    }
    const context = await browser.newContext(contextOptions);
    await context.addInitScript(INIT_OBSERVER_SCRIPT);

    for (const url of urls) {
      const result = await measurePage(context, url, waitMs, timeoutMs, confirmRemote);
      pages.push(result.page);
      if (result.operationalError) operationalFailure = true;
    }

    await context.close();
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    fail(
      `Playwright operational error: ${sanitizeText(error && error.message ? error.message : error)}. If browsers are missing, run: pnpm --filter=dashboard run e2e:install`,
    );
  }

  await browser.close().catch(() => {});

  const report = {
    schemaVersion: SCHEMA_VERSION,
    tool: TOOL_ID,
    generatedAt,
    metadata: {
      browser: 'chromium',
      environment: urls.every((url) => isLocalHostname(hostnameOf(url)))
        ? 'local'
        : 'staging',
      navigationTimeoutMs: timeoutMs,
      nodeVersion: process.version,
      playwrightPackage: '@playwright/test',
      playwrightResolvedFrom: 'apps/dashboard',
      playwrightVersion,
      storageStateProvided: Boolean(storageStatePath),
      urlSource,
      viewport: DEFAULT_VIEWPORT,
      waitMs,
    },
    notes: {
      inp: INP_REASON,
      slo: 'This tool never fails the process for slow metrics, HTTP >=400, or console errors. Nonzero exit is reserved for operational and remote-guard failures.',
      cls: `CLS is the maximum session window (gap <= ${CLS_GAP_MS}ms, window <= ${CLS_WINDOW_MS}ms), excluding shifts with recent input.`,
      transferSize:
        'transferSizeBytes is best-effort from PerformanceResourceTiming. Cross-origin resources without Timing-Allow-Origin often report 0.',
    },
    pages,
  };

  const json = stableStringify(report);
  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, json, 'utf8');
    process.stderr.write(`Wrote ${path.relative(process.cwd(), resolvedOutput) || resolvedOutput}\n`);
  } else {
    process.stdout.write(json);
  }

  process.exit(operationalFailure ? 1 : 0);
}

main();
