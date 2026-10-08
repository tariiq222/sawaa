import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './verify.mjs';
const f = fixture();
assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
const output = resolve(process.env.E2E_LOCAL_RUN_DIR, 'package-fixture.json');
assert.equal(existsSync(output), false, 'Do not create a second package fixture');
async function post(path, body, token) {
  const response = await fetch(`${process.env.BACKEND_URL}/api/v1${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  assert.ok(response.ok, `Fixture HTTP ${response.status} at ${path}`);
  return response.json();
}
const session = await post('/auth/login', { email: f.staff.email, password: process.env.E2E_USER_DASHBOARD_PASSWORD });
assert.ok(session.accessToken);
const item = await post('/dashboard/organization/packages', {
  nameAr: 'باقة اختبار جلستين', nameEn: 'E2E Two Sessions', modelVersion: 'GROUPED_V2', isPublic: true,
  groups: [{ key: 'family', label: 'جلستان أسريتان', serviceId: f.serviceId, employeeId: f.employeeId,
    sequenceMode: 'ORDERED', dependsOnGroupKey: null,
    sessions: [0, 1].map(position => ({ key: `family-${position}`, position,
      durationOptionId: f.optionId, deliveryType: 'IN_PERSON', unitPrice: 30000 })),
  }], globalDiscount: { type: 'NONE', value: 0 },
}, session.accessToken);
assert.ok(item.id);
writeFileSync(output, JSON.stringify({ packageId: item.id, priceHalalas: 60000, sessions: 2 }, null, 2), { mode: 0o600, flag: 'wx' });
console.log('Created isolated two-session package via staff API');
