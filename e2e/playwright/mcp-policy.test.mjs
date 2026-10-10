import assert from 'node:assert/strict';
import test from 'node:test';
import { createMcpPolicy } from './mcp-policy.mjs';

const policy = createMcpPolicy('/repo', [55200, 55203, 55205]);
const call = (name, args) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('writer tools stay under e2e/playwright', () => {
  assert.equal(policy(call('generator_write_test', { fileName: 'e2e/playwright/website/booking.spec.ts' })), null);
  assert.equal(policy(call('planner_save_plan', { fileName: 'e2e/playwright/plans/booking.plan.md' })), null);
  for (const fileName of ['apps/backend/src/main.ts', '../outside.md', 'e2e/playwright/../../package.json',
    '/etc/passwd', 'e2e/playwright', 'e2e/playwright-evil/x.spec.ts', undefined]) {
    assert.match(policy(call('generator_write_test', { fileName })), /e2e\/playwright/, String(fileName));
    assert.match(policy(call('planner_save_plan', { fileName })), /e2e\/playwright/, String(fileName));
  }
});

test('navigation stays on the local loopback origins', () => {
  assert.equal(policy(call('browser_navigate', { url: 'http://127.0.0.1:55205/booking' })), null);
  assert.equal(policy(call('browser_navigate', { url: 'http://127.0.0.1:55203/' })), null);
  for (const url of ['https://example.com', 'http://localhost:55205', 'http://127.0.0.1:5432', '/relative', 'javascript:alert(1)', undefined]) {
    assert.match(policy(call('browser_navigate', { url })), /only http:\/\/127\.0\.0\.1/, String(url));
  }
});

test('other messages pass through', () => {
  assert.equal(policy(call('browser_click', { ref: 'e1' })), null);
  assert.equal(policy({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), null);
  assert.equal(policy({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
