/**
 * Shared k6 safety helpers (ES modules).
 * Syntax-check with `node --input-type=module --check < file` (not `node --check file`).
 * Run load only via k6. Default target is local backend (host port 3450 → container 5200).
 */

var DEFAULT_BASE_URL = 'http://127.0.0.1:3450';

// Never follow redirects: a 3xx must fail in place so the URL guard cannot be bypassed.
var GET_REDIRECTS = 0;

var HEALTH_ROUTES = [
  { path: '/api/v1/health/live', route: 'health_live' },
  { path: '/api/v1/health/ready', route: 'health_ready' },
];

// GET-only public catalog paths from apps/backend/openapi.json. No IDs, no writes.
var PUBLIC_READ_ROUTES = [
  { path: '/api/v1/public/branding', route: 'public_branding' },
  { path: '/api/v1/public/services', route: 'public_services' },
  { path: '/api/v1/public/employees', route: 'public_employees' },
  { path: '/api/v1/public/testimonials', route: 'public_testimonials' },
  { path: '/api/v1/public/programs', route: 'public_programs' },
];

var MIXED_READ_ROUTES = HEALTH_ROUTES.concat(PUBLIC_READ_ROUTES);

function envMap() {
  if (typeof __ENV === 'undefined') {
    return {};
  }
  return __ENV;
}

function envSource(envOverride) {
  if (envOverride && typeof envOverride === 'object') {
    return envOverride;
  }
  return envMap();
}

function envStringFrom(map, name, fallback) {
  var raw = map[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  return String(raw);
}

function envBoolFrom(map, name, fallback) {
  var raw = map[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  return String(raw).toLowerCase() === 'true';
}

function envString(name, fallback) {
  return envStringFrom(envMap(), name, fallback);
}

function envInt(name, fallback) {
  var raw = envMap()[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  var n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new Error('Invalid integer env ' + name);
  }
  return n;
}

function envFloat(name, fallback) {
  var raw = envMap()[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  var n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Invalid numeric env ' + name);
  }
  return n;
}

function envBool(name, fallback) {
  return envBoolFrom(envMap(), name, fallback);
}

function stripTrailingSlash(url) {
  return String(url).replace(/\/+$/, '');
}

function parseTarget(urlString) {
  var parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid PERF_BASE_URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('PERF_BASE_URL must be http(s)');
  }
  if (!parsed.hostname) {
    throw new Error('PERF_BASE_URL is missing a hostname');
  }
  return parsed;
}

function assertNoUnsafeUrlParts(parsed) {
  if (parsed.username || parsed.password) {
    throw new Error('PERF_BASE_URL must not include credentials');
  }
  if (parsed.search || parsed.searchParams.toString() || parsed.href.indexOf('?') !== -1) {
    throw new Error('PERF_BASE_URL must not include a query string');
  }
  if (parsed.hash || parsed.href.indexOf('#') !== -1) {
    throw new Error('PERF_BASE_URL must not include a fragment');
  }
}

function isLoopbackHost(hostname) {
  var host = String(hostname)
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::ffff:127.0.0.1'
  ) {
    return true;
  }
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (host.indexOf('::ffff:127.') === 0) {
    return true;
  }
  return false;
}

function isBlockedProductionEnvironment(environment) {
  var name = String(environment || '')
    .trim()
    .toLowerCase();
  return name === 'prod' || name === 'production';
}

function isBlockedProductionHostname(hostname) {
  var host = String(hostname)
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  var labels = host.split('.');
  var i;
  for (i = 0; i < labels.length; i += 1) {
    var label = labels[i];
    if (label === 'prod' || label === 'production') {
      return true;
    }
    if (label.slice(-5) === '-prod' || label.slice(-11) === '-production') {
      return true;
    }
  }
  return false;
}

function sanitizedBaseUrl(parsed) {
  var base = parsed.origin;
  if (parsed.pathname && parsed.pathname !== '/') {
    base += parsed.pathname;
  }
  return stripTrailingSlash(base);
}

function assertSafeTarget(envOverride) {
  var env = envSource(envOverride);
  var rawBase = envStringFrom(env, 'PERF_BASE_URL', DEFAULT_BASE_URL);
  var environment = envStringFrom(env, 'PERF_ENVIRONMENT', 'local');
  var allowRemote = envBoolFrom(env, 'PERF_ALLOW_REMOTE', false);
  var confirmNonProduction = envStringFrom(env, 'PERF_CONFIRM_NON_PRODUCTION', '');
  var parsed = parseTarget(rawBase);
  assertNoUnsafeUrlParts(parsed);
  var baseUrl = sanitizedBaseUrl(parsed);
  var loopback = isLoopbackHost(parsed.hostname);

  if (isBlockedProductionHostname(parsed.hostname)) {
    throw new Error('Refusing production hostname ' + parsed.origin);
  }

  if (isBlockedProductionEnvironment(environment)) {
    throw new Error(
      'Refusing to run: PERF_ENVIRONMENT is production. This harness never targets prod/production.',
    );
  }

  if (!loopback) {
    var stagingOk =
      String(environment).toLowerCase() === 'staging' &&
      allowRemote === true &&
      confirmNonProduction === 'YES';
    if (!stagingOk) {
      throw new Error(
        'Refusing remote target ' +
          parsed.origin +
          '. Remote runs require PERF_ENVIRONMENT=staging, PERF_ALLOW_REMOTE=true, and PERF_CONFIRM_NON_PRODUCTION=YES.',
      );
    }
  }

  return {
    baseUrl: baseUrl,
    environment: environment,
    remote: !loopback,
    hostname: parsed.hostname,
  };
}

function configureHttp(httpModule) {
  // 2xx = business; 429 = counted protection. 3xx is unexpected (not followed).
  httpModule.setResponseCallback(
    httpModule.expectedStatuses({ min: 200, max: 299 }, 429),
  );
}

function createPerfMetrics(metricsModule) {
  return {
    http429: new metricsModule.Counter('http_429'),
    duration2xx: new metricsModule.Trend('http_req_duration_2xx', true),
    duration429: new metricsModule.Trend('http_req_duration_429', true),
    collapse: new metricsModule.Rate('http_collapse'),
  };
}

function classifyStatus(status) {
  var is2xx = status >= 200 && status < 300;
  var is429 = status === 429;
  var is3xx = status >= 300 && status < 400;
  var is5xx = status >= 500;
  return {
    is2xx: is2xx,
    is429: is429,
    is3xx: is3xx,
    is5xx: is5xx,
    isCollapse: !is2xx && !is429,
  };
}

function taggedGet(httpModule, checkFn, url, route, perfMetrics) {
  if (
    !perfMetrics ||
    !perfMetrics.duration2xx ||
    !perfMetrics.duration429 ||
    !perfMetrics.http429 ||
    !perfMetrics.collapse
  ) {
    throw new Error('taggedGet requires createPerfMetrics() from init context');
  }

  var res = httpModule.get(url, {
    redirects: 0,
    headers: { Accept: 'application/json' },
    tags: { name: route, route: route },
  });
  var cls = classifyStatus(res.status);
  var duration = res.timings && res.timings.duration;

  if (cls.is2xx) {
    perfMetrics.duration2xx.add(duration, { route: route });
  } else if (cls.is429) {
    perfMetrics.duration429.add(duration, { route: route });
    perfMetrics.http429.add(1, { route: route });
  }
  perfMetrics.collapse.add(cls.isCollapse, { route: route });

  var checks = {
    'no unexpected 3xx (redirects=0, not followed)': function () {
      return !cls.is3xx;
    },
    'no 5xx collapse': function () {
      return !cls.is5xx;
    },
  };
  if (cls.is2xx) {
    checks['status class 2xx business'] = function () {
      return true;
    };
  } else if (cls.is429) {
    checks['status class 429 protection'] = function () {
      return true;
    };
  } else if (cls.is3xx) {
    checks['status class 3xx unexpected'] = function () {
      return false;
    };
  } else if (cls.is5xx) {
    checks['status class 5xx collapse'] = function () {
      return false;
    };
  } else {
    checks['status class unexpected'] = function () {
      return false;
    };
  }

  checkFn(res, checks, { route: route, name: route });
  return res;
}

function thinkTime() {
  return envFloat('PERF_SLEEP', 0.2);
}

function p95ThresholdMs() {
  return envInt('PERF_P95_MS', 2000);
}

function errorRateThreshold() {
  return envFloat('PERF_ERROR_RATE', 0.05);
}

function abortOnFail() {
  return envBool('PERF_ABORT_ON_FAIL', false);
}

function thresholdSpec(expr) {
  if (abortOnFail()) {
    return { threshold: expr, abortOnFail: true };
  }
  return expr;
}

function durationThresholds(routeNames) {
  var p95 = p95ThresholdMs();
  var failed = errorRateThreshold();
  // Gate on 2xx trend + independent collapse. Mixed http_req_duration is not acceptance
  // (429s can pull p95 down). 429 is counted protection, not a latency/error gate.
  var thresholds = {
    http_req_duration_2xx: [thresholdSpec('p(95)<' + p95)],
    http_collapse: [thresholdSpec('rate<' + failed)],
    http_429: ['count>=0'],
  };
  var i;
  for (i = 0; i < routeNames.length; i += 1) {
    thresholds['http_req_duration_2xx{route:' + routeNames[i] + '}'] = [
      thresholdSpec('p(95)<' + p95),
    ];
  }
  return thresholds;
}

function metricValue(metric, key) {
  if (!metric || !metric.values) {
    return undefined;
  }
  return metric.values[key];
}

function formatNumber(value, digits) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return 'n/a';
  }
  return Number(value).toFixed(digits);
}

function renderSummary(data) {
  var lines = [
    '=== sawaa k6 perf summary ===',
    'Run-local measurements only. Not an SLO and not a capacity claim.',
    '',
  ];
  var metrics = (data && data.metrics) || {};
  var duration2xx = metrics.http_req_duration_2xx;
  var duration429 = metrics.http_req_duration_429;
  var counted429 = metrics.http_429;
  var collapse = metrics.http_collapse;
  var reqs = metrics.http_reqs;
  var mixedDuration = metrics.http_req_duration;

  lines.push('http_reqs: ' + formatNumber(metricValue(reqs, 'count'), 0));
  lines.push(
    'http_req_duration_2xx p95 (ms) [gate]: ' +
      formatNumber(metricValue(duration2xx, 'p(95)'), 2),
  );
  lines.push(
    'http_req_duration_429 p95 (ms) [not a gate]: ' +
      formatNumber(metricValue(duration429, 'p(95)'), 2),
  );
  lines.push('http_429 count: ' + formatNumber(metricValue(counted429, 'count'), 0));
  lines.push(
    'http_collapse rate (3xx/other 4xx/5xx, not 429): ' +
      formatNumber(metricValue(collapse, 'rate'), 4),
  );
  lines.push(
    'http_req_duration mixed p95 (ms) [unfiltered, not a gate]: ' +
      formatNumber(metricValue(mixedDuration, 'p(95)'), 2),
  );
  lines.push('');
  lines.push('Per-route 2xx p95 (tag `route`, no IDs):');

  Object.keys(metrics)
    .sort()
    .forEach(function (name) {
      if (name.indexOf('http_req_duration_2xx{') !== 0) {
        return;
      }
      if (name.indexOf('route:') === -1) {
        return;
      }
      lines.push(
        '  ' + name + ' p95=' + formatNumber(metricValue(metrics[name], 'p(95)'), 2) + 'ms',
      );
    });

  lines.push('');
  lines.push('Per-route 429 p95 (protection, not business success):');
  var saw429Route = false;
  Object.keys(metrics)
    .sort()
    .forEach(function (name) {
      if (name.indexOf('http_req_duration_429{') !== 0) {
        return;
      }
      if (name.indexOf('route:') === -1) {
        return;
      }
      saw429Route = true;
      lines.push(
        '  ' + name + ' p95=' + formatNumber(metricValue(metrics[name], 'p(95)'), 2) + 'ms',
      );
    });
  if (!saw429Route) {
    lines.push('  (none)');
  }

  lines.push('');
  lines.push(
    '3xx is unexpected: redirects=0 so it is a failure, not a followed hop (URL guard).',
  );
  lines.push(
    'If http_429 > 0, the edge rate limiter (or app limiter) engaged. Counted protection, not a crash and not 2xx success.',
  );
  return lines.join('\n') + '\n';
}

function handleSummary(data) {
  return { stdout: renderSummary(data) };
}

function mixedStages() {
  return [
    {
      duration: envString('PERF_WARMUP_DURATION', '10s'),
      target: envInt('PERF_WARMUP_VUS', 1),
    },
    {
      duration: envString('PERF_STEP_DURATION', '20s'),
      target: envInt('PERF_STEP_VUS', 2),
    },
    {
      duration: envString('PERF_SPIKE_DURATION', '5s'),
      target: envInt('PERF_SPIKE_VUS', 3),
    },
    {
      duration: envString('PERF_SOAK_DURATION', '10s'),
      target: envInt('PERF_SOAK_VUS', 2),
    },
    {
      duration: envString('PERF_COOLDOWN_DURATION', '5s'),
      target: envInt('PERF_COOLDOWN_VUS', 0),
    },
  ];
}

function runGuardSelfTests() {
  var secret = 'supersecret-fixture';
  var leaked = false;
  var failed = [];

  function sawSecret(value) {
    return String(value).indexOf(secret) !== -1;
  }

  function mustThrow(name, env) {
    try {
      assertSafeTarget(env);
      failed.push(name + ': expected refusal');
    } catch (err) {
      var message = err && err.message ? String(err.message) : String(err);
      if (sawSecret(message) || sawSecret(err)) {
        leaked = true;
        failed.push(name + ': redaction');
      }
    }
  }

  function mustPass(name, env) {
    try {
      assertSafeTarget(env);
    } catch (err) {
      var message = err && err.message ? String(err.message) : String(err);
      if (sawSecret(message) || sawSecret(err)) {
        leaked = true;
      }
      failed.push(name + ': unexpected refusal');
    }
  }

  mustThrow('prod-env', {
    PERF_ENVIRONMENT: 'production',
    PERF_BASE_URL: 'http://127.0.0.1:3450',
  });
  mustThrow('prod-env-short', {
    PERF_ENVIRONMENT: 'prod',
    PERF_BASE_URL: 'http://127.0.0.1:3450',
  });
  mustThrow('prod-host', {
    PERF_BASE_URL: 'https://api-prod.example.invalid',
    PERF_ENVIRONMENT: 'staging',
    PERF_ALLOW_REMOTE: 'true',
    PERF_CONFIRM_NON_PRODUCTION: 'YES',
  });
  mustThrow('production-host', {
    PERF_BASE_URL: 'https://production.example.invalid',
    PERF_ENVIRONMENT: 'staging',
    PERF_ALLOW_REMOTE: 'true',
    PERF_CONFIRM_NON_PRODUCTION: 'YES',
  });
  mustThrow('production-suffix-host', {
    PERF_BASE_URL: 'https://sawaa-production.example.invalid',
    PERF_ENVIRONMENT: 'local',
  });
  mustThrow('credentials', {
    PERF_BASE_URL: 'http://user:' + secret + '@127.0.0.1:3450',
  });
  mustThrow('query', {
    PERF_BASE_URL: 'http://127.0.0.1:3450?token=' + secret,
  });
  mustThrow('hash', {
    PERF_BASE_URL: 'http://127.0.0.1:3450#' + secret,
  });
  mustPass('local', {
    PERF_BASE_URL: 'http://127.0.0.1:3450',
    PERF_ENVIRONMENT: 'local',
  });
  mustPass('staging', {
    PERF_BASE_URL: 'https://staging.example.invalid',
    PERF_ENVIRONMENT: 'staging',
    PERF_ALLOW_REMOTE: 'true',
    PERF_CONFIRM_NON_PRODUCTION: 'YES',
  });
  mustThrow('remote-without-confirm', {
    PERF_BASE_URL: 'https://staging.example.invalid',
    PERF_ENVIRONMENT: 'staging',
  });

  if (leaked) {
    throw new Error('safety guard self-test failed: secret fixture leaked');
  }
  if (failed.length) {
    throw new Error('safety guard self-test failed: ' + failed.join(', '));
  }
  return 'ok';
}

export {
  DEFAULT_BASE_URL,
  GET_REDIRECTS,
  HEALTH_ROUTES,
  PUBLIC_READ_ROUTES,
  MIXED_READ_ROUTES,
  envString,
  envInt,
  envFloat,
  envBool,
  assertSafeTarget,
  configureHttp,
  createPerfMetrics,
  taggedGet,
  thinkTime,
  p95ThresholdMs,
  errorRateThreshold,
  abortOnFail,
  thresholdSpec,
  durationThresholds,
  handleSummary,
  mixedStages,
  runGuardSelfTests,
};
