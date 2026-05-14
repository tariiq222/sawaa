import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import {
  ZohoApiClient,
  type ZohoIntegrationConfig,
} from '../../../../infrastructure/zoho';

/**
 * Ensures a Deqah Client is mirrored as a Zoho Contact and returns the
 * Zoho contact_id. Idempotent: re-uses any existing `ZohoContactLink` row
 * before issuing a /contacts POST.
 *
 * We keep the contact create payload minimal — Zoho only really cares
 * about `contact_name` and a primary contact person with email/phone.
 * Missing email is allowed (walk-in clients), but Zoho refuses to email
 * the invoice in that case (the dashboard surfaces this).
 */
@Injectable()
export class UpsertContactHandler {
  private readonly logger = new Logger(UpsertContactHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: ZohoApiClient,
  ) {}

  async execute(input: {
    organizationId: string;
    clientId: string;
    config: ZohoIntegrationConfig;
  }): Promise<{ zohoContactId: string }> {
    const existing = await this.prisma.zohoContactLink.findUnique({
      where: {
        organizationId_deqahPersonId: {
          organizationId: input.organizationId,
          deqahPersonId: input.clientId,
        },
      },
    });
    if (existing) return { zohoContactId: existing.zohoContactId };

    const client = await this.prisma.client.findFirstOrThrow({
      where: { id: input.clientId, organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    const created = await this.api.createContact(
      {
        organizationId: input.organizationId,
        zohoOrganizationId: input.config.zohoOrganizationId,
        refreshToken: input.config.refreshToken,
        dataCenter: input.config.dataCenter,
      },
      {
        contact_name: client.name,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        contact_persons: [
          {
            first_name: client.firstName ?? undefined,
            last_name: client.lastName ?? undefined,
            email: client.email ?? undefined,
            phone: client.phone ?? undefined,
            is_primary_contact: true,
          },
        ],
      },
    );

    await this.prisma.zohoContactLink.create({
      data: {
        deqahPersonId: client.id,
        zohoContactId: created.contact.contact_id,
      },
    });

    return { zohoContactId: created.contact.contact_id };
  }
}
