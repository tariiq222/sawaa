import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database';
import { ZohoWebhookVerifier } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import {
  SYSTEM_CONTEXT_CLS_KEY,
  TENANT_CLS_KEY,
} from '../../../../common/tenant/tenant.constants';

const PLATFORM_TENANT_TOKEN = 'platform';

interface ZohoWebhookPayload {
  event_id?: string;
  event_type?: string;
  data?: {
    invoice?: { invoice_id?: string; status?: string; date?: string };
    invoice_id?: string;
    creditnote?: { creditnote_id?: string };
    customerpayment?: { payment_id?: string };
  };
  // Some Zoho events nest under `JSONString` or `data.invoice` — we treat it
  // all as a free-form JSON payload and rely on `event_type` for routing.
  [k: string]: unknown;
}

/**
 * Mirror-only webhook handler. NEVER mutates booking/payment/refund/sub state.
 *
 * Steps:
 *   1. Resolve the tenant from `tenantToken` (== organizationId for
 *      TENANT_CLIENT scope; literal "platform" for the SaaS scope).
 *   2. Look up the integration config and verify the HMAC signature with
 *      the per-tenant webhook secret.
 *   3. Dedup against ZohoWebhookEvent.eventId (unique per org).
 *   4. Dispatch on event_type, only updating the ZohoInvoiceLink mirror row.
 */
@Injectable()
export class HandleZohoWebhookHandler {
  private readonly logger = new Logger(HandleZohoWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifier: ZohoWebhookVerifier,
    private readonly config: ZohoConfigService,
    private readonly cfg: ConfigService,
    private readonly cls: ClsService,
  ) {}

  async execute(input: {
    tenantToken: string;
    rawBody: string;
    signature: string | undefined;
    payload: ZohoWebhookPayload;
  }): Promise<{ received: true }> {
    const { tenantToken, rawBody, signature, payload } = input;
    const isPlatform = tenantToken === PLATFORM_TENANT_TOKEN;

    let secret: string;
    let organizationId: string;
    let scope: 'TENANT_CLIENT' | 'SAAS_TENANT';

    if (isPlatform) {
      const platformSecret = this.cfg.get<string>('ZOHO_PLATFORM_WEBHOOK_SECRET');
      if (!platformSecret) {
        throw new NotFoundException('Platform webhook is not configured');
      }
      secret = platformSecret;
      organizationId = this.cfg.get<string>('DEFAULT_ORGANIZATION_ID') ?? '';
      scope = 'SAAS_TENANT';
    } else {
      // Resolve the tenant under SYSTEM_CONTEXT so the lookup bypasses
      // tenant scoping (we don't have a tenant CLS yet).
      const cfg = await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.config.load(tenantToken);
      });
      if (!cfg.isConfigured || !cfg.config) {
        // Don't reveal whether the org exists — return 404.
        throw new NotFoundException('Zoho integration not found');
      }
      secret = cfg.config.webhookSecret;
      organizationId = tenantToken;
      scope = 'TENANT_CLIENT';
    }

    if (!this.verifier.verify({ secret, rawBody, signature })) {
      throw new BadRequestException('Invalid Zoho webhook signature');
    }

    const eventId = payload.event_id ?? this.fallbackEventId(rawBody);
    const eventType = payload.event_type ?? 'unknown';

    // Run the rest under the resolved tenant CLS so scoped writes succeed.
    await this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId,
        id: 'system',
        role: 'system',
        isSuperAdmin: false,
      });

      try {
        await this.prisma.zohoWebhookEvent.create({
          data: {
            scope,
            eventId,
            eventType,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // Unique violation on (organizationId, eventId) → already processed.
        const code = (err as { code?: string }).code;
        if (code === 'P2002') {
          this.logger.debug(`Duplicate Zoho webhook ${eventId} — already processed`);
          return;
        }
        throw err;
      }

      await this.dispatch(organizationId, scope, eventType, payload);

      await this.prisma.zohoWebhookEvent.updateMany({
        where: { organizationId, eventId },
        data: { processedAt: new Date() },
      });
    });

    return { received: true };
  }

  private async dispatch(
    organizationId: string,
    scope: 'TENANT_CLIENT' | 'SAAS_TENANT',
    eventType: string,
    payload: ZohoWebhookPayload,
  ): Promise<void> {
    const zohoInvoiceId =
      payload.data?.invoice?.invoice_id ??
      (payload.data?.invoice_id as string | undefined);

    // We only react to events that relate to a known mirror row. Anything
    // else is stored above and ignored.
    if (!zohoInvoiceId) return;

    const update: Prisma.ZohoInvoiceLinkUpdateManyArgs['data'] = {};
    if (eventType.startsWith('invoice.thankyou') || eventType === 'invoice.paid') {
      update.status = 'paid';
    } else if (eventType === 'invoice.sent') {
      update.status = 'sent';
      update.lastSentAt = new Date();
    } else if (eventType === 'invoice.viewed') {
      update.viewedAt = new Date();
    } else if (eventType === 'invoice.void' || eventType === 'invoice.voided') {
      update.status = 'void';
    } else if (eventType === 'invoice.overdue') {
      update.status = 'overdue';
    }

    if (Object.keys(update).length === 0) return;

    await this.prisma.zohoInvoiceLink.updateMany({
      where: { organizationId, scope, zohoInvoiceId },
      data: update,
    });
  }

  /**
   * Zoho doesn't always send `event_id`. When missing, derive a stable
   * fingerprint from the raw body so dedup still works for retries.
   */
  private fallbackEventId(rawBody: string): string {
    return createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
  }
}
