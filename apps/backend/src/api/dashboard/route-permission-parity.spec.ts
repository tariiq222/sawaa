import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { PERMISSION_ACTIONS, SETTING_SPLIT_SUBJECTS } from '@sawaa/shared/constants';
import { CHECK_PERMISSIONS_KEY } from '../../common/guards/casl.guard';
import { CaslAbilityFactory } from '../../modules/identity/casl/casl-ability.factory';
import { BUILT_IN } from '../../modules/identity/casl/built-in-rules';

/**
 * Setting-subject split parity net (metadata only, no HTTP, no DB).
 *
 * Enumerates every dashboard controller route and its @CheckPermissions
 * metadata, then compares against test/fixtures/route-permissions.baseline.json
 * (captured BEFORE the `Setting` split) to prove no role/permission set gained
 * or lost access. Regenerate the baseline ONLY with WRITE_ROUTE_BASELINE=1
 * against pre-split code; it must never be refreshed after the split.
 */

const BASELINE_PATH = join(__dirname, '../../../test/fixtures/route-permissions.baseline.json');
const MIGRATION_PATH = join(
  __dirname,
  '../../../prisma/migrations/20261013000000_expand_setting_permission_subjects/migration.sql',
);

type Perm = { action: string; subject: string };
type RoutePerms = Record<string, Perm[]>;
type Baseline = { builtIn: Record<string, Perm[]>; routes: RoutePerms };

function flattenRules(rules: ReadonlyArray<{ action: unknown; subject: unknown }>): Perm[] {
  const out: Perm[] = [];
  for (const r of rules) {
    const actions = Array.isArray(r.action) ? r.action : [r.action];
    for (const a of actions) out.push({ action: String(a), subject: String(r.subject) });
  }
  return out;
}

function joinPath(...segments: Array<string | undefined>): string {
  const parts = segments.flatMap((s) => String(s ?? '').split('/')).filter((s) => s.length > 0);
  return '/' + parts.join('/');
}

function enumerateRoutes(): RoutePerms {
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const dir = __dirname;
  const routes: RoutePerms = {};
  const seen = new Set<unknown>();
  const files = readdirSync(dir).filter((f) => f.endsWith('.controller.ts')).sort();
  for (const file of files) {
    const mod = require(join(dir, file)) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const classPath = Reflect.getMetadata(PATH_METADATA, exported);
      if (classPath === undefined || seen.has(exported)) continue;
      seen.add(exported);
      const proto = (exported as { prototype: object }).prototype;
      for (const name of scanner.getAllMethodNames(proto)) {
        const handler = (proto as Record<string, unknown>)[name] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined) continue;
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler);
        const key = `${RequestMethod[method]} ${joinPath(String(classPath), String(methodPath))} @${(exported as { name: string }).name}.${name}`;
        if (key in routes) throw new Error(`Duplicate route key ${key}`);
        const required =
          reflector.getAllAndOverride<Perm[]>(CHECK_PERMISSIONS_KEY, [handler as never, exported as never]) ?? [];
        routes[key] = required.map((p) => ({ action: p.action, subject: p.subject }));
      }
    }
  }
  return routes;
}

const currentRoutes = enumerateRoutes();
const currentBuiltIn: Record<string, Perm[]> = Object.fromEntries(
  Object.entries(BUILT_IN).map(([role, rules]) => [role, flattenRules(rules)]),
);

if (process.env.WRITE_ROUTE_BASELINE === '1') {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ builtIn: currentBuiltIn, routes: currentRoutes } satisfies Baseline, null, 2) + '\n',
  );
}

const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const factory = new CaslAbilityFactory();

const SPLIT_SUBJECTS: readonly string[] = SETTING_SPLIT_SUBJECTS;

function expand(perms: Perm[]): Perm[] {
  const out = [...perms];
  for (const p of perms) {
    if (p.subject !== 'Setting') continue;
    for (const s of SPLIT_SUBJECTS) out.push({ action: p.action, subject: s });
  }
  return out;
}

function allowed(perms: Perm[], required: Perm[]): boolean {
  const ability = factory.buildFromPermissions(perms);
  return required.every((r) => ability.can(r.action, r.subject));
}

/** Route -> new subject for the 54 routes that move off `Setting`. */
const SPLIT_BY_ROUTE: Record<string, string> = {};
function split(subject: string, routes: string[]): void {
  for (const r of routes) {
    if (r in SPLIT_BY_ROUTE) throw new Error(`Route listed twice: ${r}`);
    SPLIT_BY_ROUTE[r] = subject;
  }
}
split('Content', [
  'GET /dashboard/ai/knowledge-base @DashboardAiController.listDocuments',
  'POST /dashboard/ai/knowledge-base @DashboardAiController.createDocument',
  'GET /dashboard/ai/knowledge-base/:id @DashboardAiController.getDocument',
  'POST /dashboard/ai/knowledge-base/:id/publish @DashboardAiController.publishDocument',
  'POST /dashboard/ai/knowledge-base/:id/unpublish @DashboardAiController.unpublishDocument',
  'POST /dashboard/ai/knowledge-base/:id/reindex @DashboardAiController.reindexDocument',
  'PATCH /dashboard/ai/knowledge-base/:id @DashboardAiController.updateDocument',
  'DELETE /dashboard/ai/knowledge-base/:id @DashboardAiController.deleteDocument',
  'GET /dashboard/ai/chatbot-config @DashboardAiController.getChatbotConfigEndpoint',
  'PATCH /dashboard/ai/chatbot-config @DashboardAiController.upsertChatbotConfigEndpoint',
  'GET /dashboard/comms/email-templates @DashboardCommsController.listEmailTemplatesEndpoint',
  'POST /dashboard/comms/email-templates @DashboardCommsController.createEmailTemplateEndpoint',
  'GET /dashboard/comms/email-templates/:id @DashboardCommsController.getEmailTemplateEndpoint',
  'POST /dashboard/comms/email-templates/:id/preview @DashboardCommsController.previewEmailTemplateEndpoint',
  'PATCH /dashboard/comms/email-templates/:id @DashboardCommsController.updateEmailTemplateEndpoint',
  'POST /dashboard/media/upload @DashboardMediaController.uploadFileEndpoint',
  'GET /dashboard/media/:id @DashboardMediaController.getFileEndpoint',
  'DELETE /dashboard/media/:id @DashboardMediaController.deleteFileEndpoint',
  'GET /dashboard/media/:id/presigned-url @DashboardMediaController.presignedUrlEndpoint',
  'GET /dashboard/mobile-home-cards @DashboardMobileHomeCardsController.listEndpoint',
  'POST /dashboard/mobile-home-cards @DashboardMobileHomeCardsController.createEndpoint',
  'PATCH /dashboard/mobile-home-cards/:id @DashboardMobileHomeCardsController.updateEndpoint',
  'PUT /dashboard/mobile-home-cards/reorder @DashboardMobileHomeCardsController.reorderEndpoint',
  'POST /dashboard/organization/intake-forms @DashboardOrganizationSettingsController.createIntakeFormEndpoint',
  'GET /dashboard/organization/intake-forms @DashboardOrganizationSettingsController.listIntakeFormsEndpoint',
  'GET /dashboard/organization/intake-forms/:formId @DashboardOrganizationSettingsController.getIntakeFormEndpoint',
  'PATCH /dashboard/organization/intake-forms/:formId @DashboardOrganizationSettingsController.updateIntakeFormEndpoint',
  'PUT /dashboard/organization/intake-forms/:formId/fields @DashboardOrganizationSettingsController.setIntakeFieldsEndpoint',
  'DELETE /dashboard/organization/intake-forms/:formId @DashboardOrganizationSettingsController.deleteIntakeFormEndpoint',
]);
split('PersonalData', [
  'GET /dashboard/comms/settings/sms/deliveries @DashboardCommsController.listSmsDeliveriesEndpoint',
  'GET /dashboard/comms/contact-messages @DashboardCommsController.listContactMessagesEndpoint',
  'PATCH /dashboard/comms/contact-messages/:id/status @DashboardCommsController.updateContactMessageStatusEndpoint',
  'GET /dashboard/comms/delivery-logs @DashboardCommsController.listDeliveryLogs',
  'GET /dashboard/organization/intake-forms/responses/:bookingId @DashboardOrganizationSettingsController.getIntakeFormResponsesEndpoint',
  'POST /dashboard/organization/intake-forms/responses/:bookingId @DashboardOrganizationSettingsController.submitIntakeResponseEndpoint',
]);
split('ProviderConfig', [
  'GET /dashboard/ai/provider-config @DashboardAiController.getAiProviderConfigEndpoint',
  'PUT /dashboard/ai/provider-config @DashboardAiController.upsertAiProviderConfigEndpoint',
  'POST /dashboard/ai/provider-config/test @DashboardAiController.testAiProviderConfigEndpoint',
  'GET /dashboard/ai/provider-config/models @DashboardAiController.getAiProviderModels',
  'GET /dashboard/comms/settings/sms @DashboardCommsController.getSmsConfigEndpoint',
  'POST /dashboard/comms/settings/sms @DashboardCommsController.upsertSmsConfigEndpoint',
  'POST /dashboard/comms/settings/sms/test @DashboardCommsController.testSmsConfigEndpoint',
  'GET /dashboard/comms/settings/email @DashboardCommsController.getEmailConfigEndpoint',
  'POST /dashboard/comms/settings/email @DashboardCommsController.upsertEmailConfigEndpoint',
  'POST /dashboard/comms/settings/email/test @DashboardCommsController.testEmailConfigEndpoint',
  'GET /dashboard/finance/moyasar/config @DashboardFinanceController.getMoyasarConfigEndpoint',
  'PATCH /dashboard/finance/moyasar/config @DashboardFinanceController.upsertMoyasarConfigEndpoint',
  'POST /dashboard/finance/moyasar/config/test @DashboardFinanceController.testMoyasarConfigEndpoint',
  'POST /dashboard/platform/integrations @DashboardPlatformController.upsertIntegrationEndpoint',
  'GET /dashboard/platform/integrations @DashboardPlatformController.listIntegrationsEndpoint',
]);
split('Refund', [
  'PATCH /dashboard/finance/payments/:id/refund @DashboardFinanceController.refundPaymentEndpoint',
  'POST /dashboard/finance/package-purchases/:purchaseId/refund @DashboardFinanceController.refundPackagePurchaseEndpoint',
  'POST /dashboard/refunds/approve @RefundsController.approveRefund',
  'POST /dashboard/refunds/deny @RefundsController.denyRefund',
]);

const EXPECT_ZERO_DIFF = process.env.PARITY_EXPECT_ZERO_DIFF === '1';

describe('dashboard route permission parity (Setting split)', () => {
  it('discovers the same set of routes as the baseline', () => {
    expect(Object.keys(currentRoutes).sort()).toEqual(Object.keys(baseline.routes).sort());
  });

  it('every built-in role keeps identical access on every route', () => {
    const mismatches: string[] = [];
    for (const role of Object.keys(baseline.builtIn)) {
      for (const [route, required] of Object.entries(baseline.routes)) {
        const before = allowed(baseline.builtIn[role], required);
        const after = allowed(currentBuiltIn[role], currentRoutes[route]);
        if (before !== after) mismatches.push(`${role} ${route}: ${before} -> ${after}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  describe('custom permission sets, expanded by the migration', () => {
    const sets: Array<[string, Perm[]]> = [
      ...PERMISSION_ACTIONS.map((a): [string, Perm[]] => [`Setting:${a}`, [{ action: a, subject: 'Setting' }]]),
      [
        'Setting:read + Setting:update',
        [
          { action: 'read', subject: 'Setting' },
          { action: 'update', subject: 'Setting' },
        ],
      ],
      [
        'Setting:manage + Payment:manage',
        [
          { action: 'manage', subject: 'Setting' },
          { action: 'manage', subject: 'Payment' },
        ],
      ],
    ];
    it.each(sets)('keeps identical access for %s', (_name, original) => {
      const mismatches: string[] = [];
      for (const [route, required] of Object.entries(baseline.routes)) {
        const before = allowed(original, required);
        const after = allowed(expand(original), currentRoutes[route]);
        if (before !== after) mismatches.push(`${route}: ${before} -> ${after}`);
      }
      expect(mismatches).toEqual([]);
    });
  });

  it('only diffs vs baseline are Setting -> split subject with the same action', () => {
    const diffs: Record<string, string> = {};
    for (const [route, before] of Object.entries(baseline.routes)) {
      const after = currentRoutes[route];
      expect(after.length).toBe(before.length);
      before.forEach((b, i) => {
        expect(after[i].action).toBe(b.action);
        if (after[i].subject !== b.subject) {
          expect(b.subject).toBe('Setting');
          diffs[route] = after[i].subject;
        }
      });
    }
    if (EXPECT_ZERO_DIFF) {
      expect(diffs).toEqual({});
    } else {
      expect(Object.keys(SPLIT_BY_ROUTE)).toHaveLength(54);
      expect(diffs).toEqual(SPLIT_BY_ROUTE);
    }
  });

  it('migration SQL expands exactly SETTING_SPLIT_SUBJECTS', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const values = /VALUES\s*((?:\('[A-Za-z]+'\)\s*,?\s*)+)\)?\s*AS/i.exec(sql);
    expect(values).not.toBeNull();
    const listed = [...values![1].matchAll(/\('([A-Za-z]+)'\)/g)].map((m) => m[1]);
    expect([...listed].sort()).toEqual([...SPLIT_SUBJECTS].sort());
  });
});
