import { ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ClientEnrolledEvent } from '../events/client-enrolled.event';
import { CreateClientDto } from './create-client.dto';
import { serializeClient } from './client.serializer';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { NotificationOutboxConfig } from '../../comms/notification-outbox/notification-outbox.config';
import { CaptureNotificationIntentHandler } from '../../comms/notification-outbox/capture-notification-intent.handler';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, notificationSourceKey } from '../../comms/notification-outbox/notification-outbox.types';

export type CreateClientCommand = CreateClientDto;

function composeName(firstName: string, middleName: string | undefined, lastName: string): string {
  return [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
}

@Injectable()
export class CreateClientHandler {
  private readonly logger = new Logger(CreateClientHandler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Optional() private readonly capture?: CaptureNotificationIntentHandler,
    @Optional() private readonly outboxConfig?: NotificationOutboxConfig,
  ) {}

  async execute(dto: CreateClientCommand) {
    const occurredAt = new Date();
    if (this.capture && this.outboxConfig?.shouldCapture(occurredAt)) {
      // eslint-disable-next-line no-restricted-syntax -- Single-tenant RLS was removed; atomically persist the client and both notification intents.
      const result = await this.prisma.$transaction((tx) => this.createAndCapture(dto, tx, occurredAt));
      if ('isExisting' in result && result.isExisting) return result;
      const event = new ClientEnrolledEvent({ clientId: result.id, name: result.name, phone: result.phone ?? undefined, email: result.email ?? undefined, organizationId: DEFAULT_ORG_ID });
      try {
        await this.eventBus.publish(event.eventName, { ...event.toEnvelope(), occurredAt });
      } catch {
        // Both current notification consumers have durable intents. Redis is
        // a wake-up hint after commit; lifecycle reconciliation owns recovery.
        this.logger.warn('Client enrollment wake-up unavailable; durable notification recovery will continue');
      }
      return result;
    }
    return this.createLegacy(dto, this.prisma, true, occurredAt);
  }

  private async createAndCapture(dto: CreateClientCommand, tx: Prisma.TransactionClient, occurredAt: Date) {
    const result = await this.createLegacy(dto, tx, false);
    if ('isExisting' in result && result.isExisting) return result;
    await this.capture!.execute({
      sourceKey: notificationSourceKey.clientEnrolled(result.id),
      consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt,
      payload: { kind: 'client-enrolled-client', clientId: result.id, name: result.name, phone: result.phone ?? undefined, email: result.email ?? undefined },
    }, tx);
    await this.capture!.execute({
      sourceKey: notificationSourceKey.clientEnrolled(result.id),
      consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
      payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt,
      payload: { kind: 'client-enrolled-staff', clientId: result.id, name: result.name },
    }, tx);
    return result;
  }

  private async createLegacy(dto: CreateClientCommand, db: Prisma.TransactionClient = this.prisma, publish = true, occurredAt = new Date()) {
    // Phone is the primary dedup key: a matching phone returns the existing client
    // (documented dedup behavior — staff intentionally land on the same record).
    if (dto.phone) {
      const existingByPhone = await db.client.findFirst({
        where: { phone: dto.phone, deletedAt: null },
      });
      if (existingByPhone) {
        return { ...serializeClient(existingByPhone), isExisting: true };
      }
    }

    // An email-only collision (different/absent phone) is rejected with a 409 so
    // staff aren't silently editing a different person's record.
    if (dto.email) {
      const existingByEmail = await db.client.findFirst({
        where: { email: dto.email, deletedAt: null },
      });
      if (existingByEmail) {
        throw new ConflictException({
          message: 'Email already registered for another client',
          code: 'CLIENT_EMAIL_EXISTS',
        });
      }
    }

    const fullName = composeName(dto.firstName, dto.middleName, dto.lastName);

    const client = await db.client.create({
      data: {
        name: fullName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        nationality: dto.nationality,
        nationalId: dto.nationalId,
        emergencyName: dto.emergencyName,
        emergencyPhone: dto.emergencyPhone,
        bloodType: dto.bloodType,
        allergies: dto.allergies,
        chronicConditions: dto.chronicConditions,
        avatarUrl: dto.avatarUrl,
        notes: dto.notes,
        source: dto.source,
        accountType: dto.accountType,
        isActive: dto.isActive ?? true,
        userId: dto.userId,
      },
    });

    if (publish) {
      const event = new ClientEnrolledEvent({ clientId: client.id, name: client.name, phone: client.phone ?? undefined, email: client.email ?? undefined, organizationId: DEFAULT_ORG_ID });
      await this.eventBus.publish(event.eventName, { ...event.toEnvelope(), occurredAt });
    }

    return { ...serializeClient(client), isExisting: false };
  }
}
