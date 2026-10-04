import type { StaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import { centerCancellationBody, clientCancellationBody, refundOutcomeBody } from '../events/client-cancellation-copy';
import type { ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';
import {
  NOTIFICATION_OUTBOX_CONSUMERS,
  NOTIFICATION_OUTBOX_OUTCOME_REASONS,
  NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
  type NotificationIntentPayload,
} from './notification-outbox.types';
import {
  notificationEmailDefinition,
  renderCenterCancellationEmail,
  renderFrozenNotificationEmail,
} from './notification-email-renderer';
import { isValidNotificationIntentPayload } from './notification-payload-validation';

type Db = Prisma.TransactionClient;
type Recipient = { id: string; type: 'CLIENT' | 'EMPLOYEE'; role?: string };
type Content = {
  type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_REMINDER' | 'WELCOME' | 'GENERAL';
  title: string;
  body: string;
  metadata: Record<string, string | number>;
  emailSlug?: string;
  emailVars?: Record<string, string>;
};
type Delivery = {
  intentId: string;
  recipientType: 'CLIENT' | 'EMPLOYEE';
  recipientId: string;
  channel: 'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL';
  targetKey: string;
  targetAddress: string;
  notificationId?: string;
  channelPayload: Prisma.InputJsonValue;
  status?: 'READY' | 'DELIVERED' | 'SKIPPED' | 'DEAD';
  deliveredAt?: Date;
  outcomeReason?: string;
};

const STAFF_BOOKING_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'];
const STAFF_ENROLLED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];
const STAFF_CONTACT_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'];
const targetKey = (address: string): string =>
  createHash('sha256').update(address).digest('hex');

function record(payload: NotificationIntentPayload): Record<string, unknown> {
  return payload as unknown as Record<string, unknown>;
}

@Injectable()
export class MaterializeNotificationIntentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(intentId: string): Promise<void> {
    // This background reconciler has no request context. Sawaa is single-tenant
    // and RLS has been removed; the direct transaction fences materialization.
    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$transaction(async (tx) => {
      // Serialize direct consumers and reconciliation workers. No queue or
      // provider I/O occurs while this short transaction holds the row lock.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "NotificationIntent"
        WHERE "id" = ${intentId}::uuid
        FOR UPDATE
      `);
      const intent = await tx.notificationIntent.findUnique({ where: { id: intentId } });
      if (!intent || ['MATERIALIZED', 'DEAD', 'EXPIRED'].includes(intent.status)) return;
      if (intent.payloadVersion !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION) {
        await tx.notificationIntent.update({ where: { id: intentId }, data: { status: 'DEAD' } });
        return;
      }
      if (intent.expiresAt && intent.expiresAt.getTime() <= Date.now()) {
        await tx.notificationIntent.update({ where: { id: intentId }, data: { status: 'EXPIRED' } });
        return;
      }

      const payload = intent.payload as unknown as NotificationIntentPayload;
      if (!isValidNotificationIntentPayload(intent.consumerKey, payload)) {
        await tx.notificationIntent.update({ where: { id: intentId }, data: { status: 'DEAD' } });
        return;
      }
      if (!(await this.isStillEligible(tx, intent.consumerKey, payload))) {
        await tx.notificationIntent.update({ where: { id: intentId }, data: { status: 'EXPIRED' } });
        return;
      }

      const audience = await this.resolveAudience(tx, intent.consumerKey, payload);
      const rows: Delivery[] = [];
      for (const recipient of audience) {
        const content = this.content(intent.consumerKey, payload);
        const notification = await tx.notification.create({
          data: {
            recipientId: recipient.id,
            recipientType: recipient.type,
            type: content.type,
            title: content.title,
            body: content.body,
            metadata: content.metadata,
          },
          select: { id: true },
        });
        rows.push({
          intentId,
          recipientType: recipient.type,
          recipientId: recipient.id,
          channel: 'IN_APP',
          targetKey: 'in-app',
          targetAddress: 'in-app',
          notificationId: notification.id,
          channelPayload: {
            channel: 'IN_APP',
            notificationType: content.type,
            title: content.title,
            body: content.body,
            metadata: content.metadata,
          },
          status: 'DELIVERED',
          deliveredAt: new Date(),
        });

        if (recipient.type === 'CLIENT') {
          const target = await this.clientTargetData(tx, payload);
          rows.push(...await this.externalDeliveries(tx, intentId, recipient, content, target));
        }
      }

      if (rows.length > 0) await tx.notificationDelivery.createMany({ data: rows });
      await tx.notificationIntent.update({
        where: { id: intentId },
        data: { status: 'MATERIALIZED', leaseToken: null, leaseUntil: null, nextAttemptAt: null },
      });
    });
  }

  private async isStillEligible(
    tx: Db,
    consumerKey: string,
    payload: NotificationIntentPayload,
  ): Promise<boolean> {
    if (consumerKey !== NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT) return true;
    if (payload.kind !== 'booking-reminder-client') return false;
    const booking = await tx.booking.findUnique({
      where: { id: payload.bookingId },
      select: { status: true, scheduledAt: true, clientId: true },
    });
    const scheduledAt = new Date(payload.scheduledAt);
    return Boolean(
      booking &&
      ['CONFIRMED', 'DEPOSIT_PAID'].includes(booking.status) &&
      booking.clientId === payload.clientId &&
      booking.scheduledAt.getTime() === scheduledAt.getTime() &&
      scheduledAt.getTime() > Date.now(),
    );
  }

  private async resolveAudience(
    tx: Db,
    consumerKey: string,
    payload: NotificationIntentPayload,
  ): Promise<Recipient[]> {
    const value = record(payload);
    if (
      consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF ||
      consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF
    ) {
      const users = await tx.user.findMany({
        where: { role: { in: STAFF_BOOKING_ROLES }, isActive: true },
        select: { id: true, role: true },
      });
      return this.withAssignedEmployee(users, value.employeeId as string | undefined);
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF) {
      const users = await tx.user.findMany({
        where: { role: { in: STAFF_ENROLLED_ROLES }, isActive: true },
        select: { id: true, role: true },
      });
      return users.map((user) => ({ id: user.id, type: 'EMPLOYEE', role: user.role }));
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CONTACT_MESSAGE_STAFF) {
      const users = await tx.user.findMany({
        where: { role: { in: STAFF_CONTACT_ROLES }, isActive: true },
        select: { id: true, role: true },
      });
      return users.map((user) => ({ id: user.id, type: 'EMPLOYEE', role: user.role }));
    }
    if ('clientId' in value && typeof value.clientId === 'string') {
      const client = await tx.client.findUnique({
        where: { id: value.clientId },
        select: { id: true, isActive: true, deletedAt: true },
      });
      return client?.isActive && !client.deletedAt ? [{ id: value.clientId, type: 'CLIENT' }] : [];
    }
    return [];
  }

  private withAssignedEmployee(
    users: Array<{ id: string; role: string }>,
    includeUserId?: string,
  ): Recipient[] {
    const recipients: Recipient[] = users.map((user) => ({ id: user.id, type: 'EMPLOYEE', role: user.role }));
    if (includeUserId && !recipients.some((recipient) => recipient.id === includeUserId)) {
      recipients.push({ id: includeUserId, type: 'EMPLOYEE', role: 'EMPLOYEE' });
    }
    return recipients;
  }

  private content(consumerKey: string, payload: NotificationIntentPayload): Content {
    const value = record(payload);
    const email = notificationEmailDefinition(consumerKey, payload);
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF) {
      return { type: 'BOOKING_CREATED', title: 'حجز جديد', body: `تم إنشاء حجز جديد ${value.bookingNumber ?? value.bookingId}`, metadata: { bookingId: String(value.bookingId) } };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF) {
      return { type: 'BOOKING_CANCELLED', title: value.centerCancellation ? 'تم إلغاء البرنامج' : 'تم إلغاء حجز', body: value.centerCancellation ? centerCancellationBody(value.centerCancellation as StaffCancellationIntent) : `تم إلغاء الحجز ${value.bookingNumber ?? value.bookingId} — ${value.reason ?? ''}`, metadata: { bookingId: String(value.bookingId) } };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT) {
      return { type: 'BOOKING_CANCELLED', title: value.centerCancellation ? 'تم إلغاء البرنامج' : 'تم إلغاء الموعد', body: value.centerCancellation ? centerCancellationBody(value.centerCancellation as StaffCancellationIntent) : clientCancellationBody(value.clientCancellation as ClientCancellationIntent | undefined), metadata: { bookingId: String(value.bookingId) }, emailSlug: email?.templateSlug, emailVars: email?.variables };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.REFUND_OUTCOME_CLIENT) {
      return { type: 'GENERAL', title: 'تحديث الاسترداد', body: refundOutcomeBody(String(value.status), Number(value.amount), String(value.currency)), metadata: { bookingId: String(value.bookingId ?? ''), refundRequestId: String(value.refundRequestId), refundStatus: String(value.status) } };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT) {
      return { type: 'BOOKING_REMINDER', title: 'تذكير بموعدك', body: 'تذكير بموعدك غداً. افتح التطبيق للتفاصيل.', metadata: { bookingId: String(value.bookingId) }, emailSlug: email?.templateSlug, emailVars: email?.variables };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT) {
      return { type: 'WELCOME', title: 'مرحباً بك!', body: `أهلاً ${value.name ?? ''}، يسعدنا انضمامك إلينا.`, metadata: { clientId: String(value.clientId) }, emailSlug: email?.templateSlug, emailVars: email?.variables };
    }
    if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF) {
      return { type: 'WELCOME', title: 'عميل جديد', body: `انضم عميل جديد: ${value.name ?? ''}`, metadata: { clientId: String(value.clientId) } };
    }
    return { type: 'GENERAL', title: 'رسالة تواصل جديدة', body: 'تم استلام رسالة جديدة عبر الموقع', metadata: { contactMessageId: String(value.contactMessageId) } };
  }

  private async clientTargetData(tx: Db, payload: NotificationIntentPayload) {
    const value = record(payload);
    const clientId = typeof value.clientId === 'string' ? value.clientId : undefined;
    const client = clientId ? await tx.client.findUnique({ where: { id: clientId }, select: { name: true, phone: true, email: true, pushEnabled: true } }) : null;
    const tokens = clientId ? await tx.fcmToken.findMany({ where: { clientId }, select: { token: true } }) : [];
    return {
      phone: (value.clientPhone as string | undefined) ?? client?.phone,
      email: (value.clientEmail as string | undefined) ?? client?.email,
      name: (value.clientName as string | undefined) ?? (value.name as string | undefined) ?? client?.name,
      pushEnabled: client?.pushEnabled ?? false,
      tokens: tokens.map((row) => row.token),
    };
  }

  private async externalDeliveries(
    tx: Db,
    intentId: string,
    recipient: Recipient,
    content: Content,
    target: { phone?: string | null; email?: string | null; name?: string | null; pushEnabled: boolean; tokens: string[] },
  ): Promise<Delivery[]> {
    const rows: Delivery[] = [];
    const resolvedContent =
      target.name && content.emailVars && !content.emailVars.client_name
        ? { ...content, emailVars: { ...content.emailVars, client_name: target.name } }
        : content;
    const isReminder = content.type === 'BOOKING_REMINDER';
    const supportsPush = isReminder || content.type === 'BOOKING_CANCELLED' || Boolean(content.metadata.refundRequestId);
    if (supportsPush) {
      if (target.pushEnabled && target.tokens.length > 0) {
        // FCM data values must be strings. Carry the booking routing key so a
        // tapped push opens the exact appointment instead of only the list.
        const pushData: Record<string, string> = { notificationType: content.type };
        if (content.metadata.bookingId != null) {
          pushData.bookingId = String(content.metadata.bookingId);
        }
        for (const token of target.tokens) {
          rows.push({ intentId, recipientType: recipient.type, recipientId: recipient.id, channel: 'PUSH', targetKey: targetKey(token), targetAddress: token, channelPayload: { channel: 'PUSH', title: content.title, body: content.body, data: pushData } });
        }
      } else {
        rows.push(this.skipped(intentId, recipient, 'PUSH', target.pushEnabled ? NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET : NOTIFICATION_OUTBOX_OUTCOME_REASONS.RECIPIENT_DISABLED));
      }
    }
    if (isReminder) {
      if (target.phone) {
        rows.push({ intentId, recipientType: recipient.type, recipientId: recipient.id, channel: 'SMS', targetKey: targetKey(target.phone), targetAddress: target.phone, channelPayload: { channel: 'SMS', body: content.body } });
      } else {
        rows.push(this.skipped(intentId, recipient, 'SMS', NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET));
      }
    }
    const wantsEmail = Boolean(content.emailSlug) && (!isReminder || Boolean(target.email));
    if (wantsEmail) {
      if (!target.email) rows.push(this.skipped(intentId, recipient, 'EMAIL', NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET));
      else rows.push(await this.emailDelivery(tx, intentId, recipient, target.email, resolvedContent));
    }
    return rows;
  }

  private async emailDelivery(
    tx: Db,
    intentId: string,
    recipient: Recipient,
    address: string,
    content: Content,
  ): Promise<Delivery> {
    const base = { intentId, recipientType: recipient.type, recipientId: recipient.id, channel: 'EMAIL' as const, targetKey: targetKey(address), targetAddress: address };
    if (content.emailSlug === 'program-cancelled') return { ...base, channelPayload: renderCenterCancellationEmail(content.emailVars ?? {}) };
    const template = await tx.emailTemplate.findFirst({ where: { slug: content.emailSlug, isActive: true }, select: { subject: true, htmlBody: true } });
    if (!template) {
      return { ...base, channelPayload: { channel: 'EMAIL', templateSlug: content.emailSlug ?? '', subject: '', html: '' }, status: 'DEAD', outcomeReason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.TEMPLATE_UNAVAILABLE };
    }
    return {
      ...base,
      channelPayload: renderFrozenNotificationEmail(
        { templateSlug: content.emailSlug ?? '', variables: content.emailVars ?? {} },
        template,
      ),
    };
  }

  private skipped(
    intentId: string,
    recipient: Recipient,
    channel: 'PUSH' | 'SMS' | 'EMAIL',
    reason: string,
  ): Delivery {
    const unavailable = `${channel.toLowerCase()}-unavailable`;
    const payload = channel === 'PUSH' ? { channel, title: '', body: '' } : channel === 'SMS' ? { channel, body: '' } : { channel, templateSlug: '', subject: '', html: '' };
    return { intentId, recipientType: recipient.type, recipientId: recipient.id, channel, targetKey: targetKey(unavailable), targetAddress: unavailable, channelPayload: payload, status: 'SKIPPED', outcomeReason: reason };
  }
}
