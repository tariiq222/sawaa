/**
 * Health-only k6 scenario. Measures /api/v1/health/live and /api/v1/health/ready
 * as separate tagged routes. GET only. Run with k6.
 * Syntax-check with `node --input-type=module --check < file` (not `node --check file`).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  assertSafeTarget,
  configureHttp,
  createPerfMetrics,
  durationThresholds,
  envInt,
  envString,
  taggedGet,
  thinkTime,
} from './safety.js';

export { handleSummary } from './safety.js';

var perfMetrics = createPerfMetrics({
  Counter: Counter,
  Rate: Rate,
  Trend: Trend,
});

configureHttp(http);

var duration = envString('PERF_DURATION', '10s');
var vus = envInt('PERF_VUS', 1);

export const options = {
  scenarios: {
    live: {
      executor: 'constant-vus',
      vus: vus,
      duration: duration,
      exec: 'live',
      tags: { scenario: 'health_live' },
    },
    ready: {
      executor: 'constant-vus',
      vus: vus,
      duration: duration,
      exec: 'ready',
      tags: { scenario: 'health_ready' },
    },
  },
  thresholds: durationThresholds(['health_live', 'health_ready']),
};

export function setup() {
  return assertSafeTarget();
}

export function live(data) {
  taggedGet(
    http,
    check,
    data.baseUrl + '/api/v1/health/live',
    'health_live',
    perfMetrics,
  );
  sleep(thinkTime());
}

export function ready(data) {
  taggedGet(
    http,
    check,
    data.baseUrl + '/api/v1/health/ready',
    'health_ready',
    perfMetrics,
  );
  sleep(thinkTime());
}
