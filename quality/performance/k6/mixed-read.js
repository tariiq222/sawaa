/**
 * Mixed GET load: health live/ready plus public catalog reads.
 * Stages are env-tunable; defaults stay small. 429 is counted protection, not a crash.
 * Syntax-check with `node --input-type=module --check < file` (not `node --check file`).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  MIXED_READ_ROUTES,
  assertSafeTarget,
  configureHttp,
  createPerfMetrics,
  durationThresholds,
  mixedStages,
  taggedGet,
  thinkTime,
} from './safety.js';

export { handleSummary } from './safety.js';

var perfMetrics = createPerfMetrics({
  Counter: Counter,
  Rate: Rate,
  Trend: Trend,
});
var routes = MIXED_READ_ROUTES;

configureHttp(http);

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: mixedStages(),
      gracefulRampDown: '5s',
      tags: { scenario: 'mixed_read' },
    },
  },
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
