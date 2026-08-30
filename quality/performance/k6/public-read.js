/**
 * Public GET catalog reads from OpenAPI. No auth, no IDs, no writes.
 * Paths: branding, services, employees, testimonials, programs.
 * Syntax-check with `node --input-type=module --check < file` (not `node --check file`).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  PUBLIC_READ_ROUTES,
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
var routes = PUBLIC_READ_ROUTES;

configureHttp(http);

export const options = {
  vus: envInt('PERF_VUS', 1),
  duration: envString('PERF_DURATION', '15s'),
  thresholds: durationThresholds(
    routes.map(function (item) {
      return item.route;
    }),
  ),
};

export function setup() {
  return assertSafeTarget();
}

export default function (data) {
  var item = routes[(__VU + __ITER) % routes.length];
  taggedGet(http, check, data.baseUrl + item.path, item.route, perfMetrics);
  sleep(thinkTime());
}
