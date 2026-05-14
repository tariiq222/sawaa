import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { HandleZohoWebhookHandler } from './handle-event.handler';
import { ZohoWebhookVerifier } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { PrismaService } from '../../../../infrastructure/database';

/**
 * Webhook handler isolation contract:
 *
 *   1. The path-supplied tenantToken MUST match a real Integration row;
 *      otherwise return 404. (Don't 401 — that would let attackers enumerate.)
 *   2. Signature MUST verify against the per-tenant secret resolved from the
 *      Integration row — never against a global / shared secret.
 *   3. Tenant A cannot deliver a webhook signed with Tenant B's secret onto
 *      Tenant A's path: either the secret mismatch fails verification, or
 *      the path mismatch hits a different tenant entirely.
 *   4. Mirror updates MUST be scoped to the resolved tenant + scope.
 *   5. Booking / Payment / Refund / Subscription tables MUST never be
 *      touched — only ZohoInvoiceLink / ZohoWebhookEvent.
 */
describe('HandleZohoWebhookHandler — tenant isolation', () => {
  const TENANT_A = 'org-A';
  const _TENANT_B = 'org-B';
  const SECRET_A = 'a'.repeat(64);
  const SECRET_B = 'b'.repeat(64);

  function sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  async function makeHandler() {
    const _findUnique = jest.fn();
    const linkUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const eventCreate = jest.fn().mockResolvedValue({ id: 'ev-1' });
    const eventUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      zohoWebhookEvent: { create: eventCreate, updateMany: eventUpdateMany },
      zohoInvoiceLink: { updateMany: linkUpdateMany },
      // Booking / payment / refund / subscription deliberately absent —
      // any access would throw "is not a function" and fail the test.
    } as unknown as PrismaService;

    const configLoad = jest.fn();
    const configSvc = { load: configLoad } as unknown as ZohoConfigService;

    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              ZOHO_PLATFORM_WEBHOOK_SECRET: 'platform-secret',
              DEFAULT_ORGANIZATION_ID: 'platform-org',
            }),
          ],
        }),
      ],
      providers: [
        HandleZohoWebhookHandler,
        ZohoWebhookVerifier,
        { provide: PrismaService, useValue: prisma },
        { provide: ZohoConfigService, useValue: configSvc },
      ],
    }).compile();

    return {
      handler: mod.get(HandleZohoWebhookHandler),
      cls: mod.get(ClsService),
      cfg: mod.get(ConfigService),
      configLoad,
      eventCreate,
      eventUpdateMany,
      linkUpdateMany,
    };
  }

  it('returns 404 when the tenantToken has no matching Integration row', async () => {
    const { handler, configLoad } = await makeHandler();
    configLoad.mockResolvedValue({ isConfigured: false, isActive: false });
    const body = JSON.stringify({ event_id: 'e1', event_type: 'invoice.paid' });

    await expect(
      handler.execute({
        tenantToken: 'unknown-org',
        rawBody: body,
        signature: sign(SECRET_A, body),
        payload: JSON.parse(body),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifies the signature with the PER-TENANT secret loaded from the Integration row', async () => {
    const { handler, configLoad } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({ event_id: 'e1', event_type: 'invoice.paid' });

    // Tenant A delivery, signed with Tenant A secret → accepted.
    await expect(
      handler.execute({
        tenantToken: TENANT_A,
        rawBody: body,
        signature: sign(SECRET_A, body),
        payload: JSON.parse(body),
      }),
    ).resolves.toEqual({ received: true });
  });

  it('REJECTS with 400 when the signature was made with another tenant secret', async () => {
    const { handler, configLoad } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({ event_id: 'e1', event_type: 'invoice.paid' });

    // Tenant A delivery, signed with Tenant B's secret → rejected.
    await expect(
      handler.execute({
        tenantToken: TENANT_A,
        rawBody: body,
        signature: sign(SECRET_B, body),
        payload: JSON.parse(body),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REJECTS unsigned deliveries even when the tenant exists', async () => {
    const { handler, configLoad } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({ event_id: 'e1', event_type: 'invoice.paid' });

    await expect(
      handler.execute({
        tenantToken: TENANT_A,
        rawBody: body,
        signature: undefined,
        payload: JSON.parse(body),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mirror-update writes are SCOPED to the resolved tenant + TENANT_CLIENT scope', async () => {
    const { handler, configLoad, linkUpdateMany, eventCreate } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({
      event_id: 'evt-paid-1',
      event_type: 'invoice.paid',
      data: { invoice: { invoice_id: 'zinv_1' } },
    });

    await handler.execute({
      tenantToken: TENANT_A,
      rawBody: body,
      signature: sign(SECRET_A, body),
      payload: JSON.parse(body),
    });

    // org scoping moved to RLS / removed in single-tenant migration
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'TENANT_CLIENT',
        eventId: 'evt-paid-1',
      }),
    });
    expect(linkUpdateMany).toHaveBeenCalledWith({
      where: { organizationId: TENANT_A, scope: 'TENANT_CLIENT', zohoInvoiceId: 'zinv_1' },
      data: expect.objectContaining({ status: 'paid' }),
    });
  });

  it('event dedup short-circuits on Prisma P2002', async () => {
    const { handler, configLoad, eventCreate, linkUpdateMany } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    eventCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const body = JSON.stringify({
      event_id: 'evt-1',
      event_type: 'invoice.paid',
      data: { invoice: { invoice_id: 'zinv_1' } },
    });

    await expect(
      handler.execute({
        tenantToken: TENANT_A,
        rawBody: body,
        signature: sign(SECRET_A, body),
        payload: JSON.parse(body),
      }),
    ).resolves.toEqual({ received: true });

    // Dispatch must NOT run when we hit a duplicate.
    expect(linkUpdateMany).not.toHaveBeenCalled();
  });

  it('events without a recognized invoice id are stored but trigger no mirror update', async () => {
    const { handler, configLoad, linkUpdateMany } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({ event_id: 'e2', event_type: 'something.else' });

    await handler.execute({
      tenantToken: TENANT_A,
      rawBody: body,
      signature: sign(SECRET_A, body),
      payload: JSON.parse(body),
    });

    expect(linkUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['invoice.paid', 'paid'],
    ['invoice.thankyou', 'paid'],
    ['invoice.sent', 'sent'],
    ['invoice.void', 'void'],
    ['invoice.voided', 'void'],
    ['invoice.overdue', 'overdue'],
  ])('maps Zoho event %s → ZohoInvoiceLink.status %s', async (eventType, expected) => {
    const { handler, configLoad, linkUpdateMany } = await makeHandler();
    configLoad.mockResolvedValue({
      isConfigured: true,
      isActive: true,
      config: {
        refreshToken: 'rt',
        zohoOrganizationId: 'z',
        dataCenter: 'sa',
        webhookSecret: SECRET_A,
        defaults: { sendOnCreate: false },
      },
    });
    const body = JSON.stringify({
      event_id: `evt-${eventType}`,
      event_type: eventType,
      data: { invoice: { invoice_id: 'zinv_X' } },
    });
    await handler.execute({
      tenantToken: TENANT_A,
      rawBody: body,
      signature: sign(SECRET_A, body),
      payload: JSON.parse(body),
    });

    expect(linkUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: expected }),
      }),
    );
  });

  it('uses platform secret + SAAS_TENANT scope for the special "platform" path', async () => {
    const { handler, eventCreate, linkUpdateMany } = await makeHandler();
    const body = JSON.stringify({
      event_id: 'plat-1',
      event_type: 'invoice.paid',
      data: { invoice: { invoice_id: 'zinv_platform' } },
    });

    await handler.execute({
      tenantToken: 'platform',
      rawBody: body,
      signature: sign('platform-secret', body),
      payload: JSON.parse(body),
    });

    // org scoping moved to RLS / removed in single-tenant migration
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'SAAS_TENANT',
      }),
    });
    expect(linkUpdateMany).toHaveBeenCalledWith({
      where: { organizationId: 'platform-org', scope: 'SAAS_TENANT', zohoInvoiceId: 'zinv_platform' },
      data: expect.any(Object),
    });
  });
});
