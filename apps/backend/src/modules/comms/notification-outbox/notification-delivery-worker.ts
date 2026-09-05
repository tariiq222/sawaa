import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  NOTIFICATION_OUTBOX_LEASE_MS,
  NOTIFICATION_OUTBOX_LEASE_RENEW_MS,
  NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS,
  NOTIFICATION_OUTBOX_RETRY_DELAYS_MS,
  NotificationOutboxConfig,
} from './notification-outbox.config';
import {
  NotificationChannelSender,
  type NotificationChannelSendResult,
  type ClaimedNotificationDelivery,
} from './notification-channel-sender';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NOTIFICATION_OUTBOX_OUTCOME_REASONS } from './notification-outbox.types';
import { NotificationOutboxMetrics } from './notification-outbox.metrics';

type Claimed = ClaimedNotificationDelivery & {
  attempts: number;
  leaseToken: string;
  attemptId?: string;
  expiresAt?: Date | null;
};

type EligibilityFailure = {
  status: 'SKIPPED' | 'EXPIRED';
  reason: string;
};

@Injectable()
export class NotificationDeliveryWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: NotificationChannelSender,
    private readonly config: NotificationOutboxConfig,
    @Optional() private readonly metrics?: NotificationOutboxMetrics,
  ) {}

  async process(deliveryId: string, generation: number): Promise<void> {
    if (!this.config.deliveryEnabled) return;
    const claimed = await this.claim(deliveryId, generation);
    if (!claimed) return;

    if (!claimed.targetAddress) {
      await this.finish(claimed, {
        outcome: 'SKIPPED',
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET,
      });
      return;
    }

    let renewTimer: ReturnType<typeof setInterval> | undefined;
    let result: NotificationChannelSendResult;
    try {
      renewTimer = setInterval(() => {
        void this.prisma.notificationDelivery.updateMany({
          where: {
            id: claimed.id,
            status: 'SENDING',
            leaseToken: claimed.leaseToken,
          },
          data: { leaseUntil: new Date(Date.now() + NOTIFICATION_OUTBOX_LEASE_MS) },
        }).then((renewed) => {
          if (renewed.count !== 1 && renewTimer) clearInterval(renewTimer);
        }).catch(() => {
          if (renewTimer) clearInterval(renewTimer);
        });
      }, NOTIFICATION_OUTBOX_LEASE_RENEW_MS);
      result = await this.withProviderTimeout(claimed);
    } catch {
      result = {
        outcome: 'UNKNOWN',
        errorCode: 'PROVIDER_ERROR',
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.AMBIGUOUS_PROVIDER_OUTCOME,
      };
    } finally {
      if (renewTimer) clearInterval(renewTimer);
    }
    await this.finish(claimed, result);
  }

  private async withProviderTimeout(
    delivery: Claimed,
  ): Promise<NotificationChannelSendResult> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<NotificationChannelSendResult>((resolve) => {
      timeout = setTimeout(() => {
        resolve({
          outcome: 'UNKNOWN',
          errorCode: 'PROVIDER_TIMEOUT',
          reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.AMBIGUOUS_PROVIDER_OUTCOME,
        });
      }, 30_000);
    });
    try {
      return await Promise.race([this.sender.send(delivery), timeoutResult]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async claim(deliveryId: string, generation: number): Promise<Claimed | null> {
    // This queue worker has no request context. Sawaa is single-tenant and RLS
    // has been removed; the direct transaction atomically claims the lease.
    // eslint-disable-next-line no-restricted-syntax
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const row = await tx.notificationDelivery.findFirst({
        where: {
          id: deliveryId,
          enqueueGeneration: generation,
          status: { in: ['READY', 'RETRY_WAIT'] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        include: {
          intent: { select: { expiresAt: true, consumerKey: true, payload: true } },
        },
      });
      if (!row) return null;

      const expiresAt = row.intent.expiresAt;
      if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
        await tx.notificationDelivery.updateMany({
          where: { id: row.id, status: row.status, enqueueGeneration: generation },
          data: {
            status: 'EXPIRED',
            outcomeReason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.EXPIRED,
          },
        });
        return null;
      }

      const ineligible = await this.currentEligibility(tx, row, now);
      if (ineligible) {
        await tx.notificationDelivery.updateMany({
          where: { id: row.id, status: row.status, enqueueGeneration: generation },
          data: { status: ineligible.status, outcomeReason: ineligible.reason },
        });
        return null;
      }
      if (Number(row.attempts ?? 0) >= NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS) {
        await tx.notificationDelivery.updateMany({
          where: { id: row.id, status: row.status, enqueueGeneration: generation },
          data: {
            status: 'DEAD',
            outcomeReason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.ATTEMPTS_EXHAUSTED,
          },
        });
        return null;
      }

      const leaseToken = randomUUID();
      const attempts = Number(row.attempts ?? 0) + 1;
      const updated = await tx.notificationDelivery.updateMany({
        where: {
          id: row.id,
          status: row.status,
          enqueueGeneration: generation,
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        data: {
          status: 'SENDING',
          leaseToken,
          leaseUntil: new Date(now.getTime() + NOTIFICATION_OUTBOX_LEASE_MS),
          attempts: { increment: 1 },
        },
      });
      if (updated.count !== 1) return null;

      const attempt = await tx.notificationDeliveryAttempt.create({
        data: {
          deliveryId: row.id,
          attemptNumber: attempts,
          leaseToken,
          outcome: 'STARTED',
        },
      });
      return {
        ...row,
        attempts,
        leaseToken,
        attemptId: attempt?.id,
        expiresAt,
      } as Claimed;
    });
  }

  private async currentEligibility(
    tx: Prisma.TransactionClient,
    row: {
      recipientType: 'CLIENT' | 'EMPLOYEE';
      recipientId: string;
      channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
      targetAddress: string;
      intent: { consumerKey: string; payload: unknown };
    },
    now: Date,
  ): Promise<EligibilityFailure | null> {
    if (!row.targetAddress) {
      return { status: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET };
    }

    if (row.recipientType === 'CLIENT') {
      const client = await tx.client.findUnique({
        where: { id: row.recipientId },
        select: { isActive: true, deletedAt: true, pushEnabled: true },
      });
      if (!client || !client.isActive || client.deletedAt) {
        return { status: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.RECIPIENT_DISABLED };
      }
      if (row.channel === 'PUSH') {
        if (!client.pushEnabled) {
          return { status: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.RECIPIENT_DISABLED };
        }
        const token = await tx.fcmToken.findFirst({
          where: { clientId: row.recipientId, token: row.targetAddress },
          select: { id: true },
        });
        if (!token) {
          return { status: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET };
        }
      }
    } else {
      const user = await tx.user.findUnique({
        where: { id: row.recipientId },
        select: { isActive: true },
      });
      if (!user?.isActive) {
        return { status: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.RECIPIENT_DISABLED };
      }
    }

    if (row.intent.consumerKey === 'comms.booking-reminder-client.v2') {
      const payload = row.intent.payload as { bookingId?: unknown; scheduledAt?: unknown };
      if (typeof payload.bookingId !== 'string' || typeof payload.scheduledAt !== 'string') {
        return { status: 'EXPIRED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD };
      }
      const booking = await tx.booking.findUnique({
        where: { id: payload.bookingId },
        select: { status: true, scheduledAt: true },
      });
      const scheduledAt = new Date(payload.scheduledAt);
      if (
        !booking ||
        booking.status !== 'CONFIRMED' ||
        booking.scheduledAt.getTime() !== scheduledAt.getTime() ||
        scheduledAt.getTime() <= now.getTime()
      ) {
        return { status: 'EXPIRED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.EXPIRED };
      }
    }
    return null;
  }

  private async finish(
    claimed: Claimed,
    result: NotificationChannelSendResult,
  ): Promise<void> {
    const status = result.outcome;
    const now = new Date();
    const expired = Boolean(
      claimed.expiresAt && new Date(claimed.expiresAt).getTime() <= now.getTime(),
    );
    // Expiry prevents a future provider attempt. Once a call has started, its
    // accepted or ambiguous outcome remains authoritative and inspectable.
    let finalStatus: NotificationChannelSendResult['outcome'] | 'EXPIRED' =
      status === 'RETRY_WAIT' && expired ? 'EXPIRED' : status;
    if (
      finalStatus === 'RETRY_WAIT' &&
      claimed.attempts >= NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS
    ) {
      finalStatus = 'DEAD';
    }
    const data: Record<string, unknown> = {
      status: finalStatus,
      leaseToken: null,
      leaseUntil: null,
      outcomeReason:
        finalStatus === 'DEAD' && status === 'RETRY_WAIT'
          ? NOTIFICATION_OUTBOX_OUTCOME_REASONS.ATTEMPTS_EXHAUSTED
          : result.reason
            ? this.safeReason(result.reason)
            : undefined,
      providerName: result.providerName,
      providerMessageId: result.providerMessageId,
      acceptedAt: status === 'ACCEPTED' ? now : undefined,
      deliveredAt: status === 'DELIVERED' ? now : undefined,
      nextAttemptAt: null,
    };
    if (finalStatus === 'RETRY_WAIT') {
      data.outcomeReason = NOTIFICATION_OUTBOX_OUTCOME_REASONS.SAFE_TRANSIENT;
      data.nextAttemptAt = new Date(
        now.getTime() + this.retryDelay(result.retryAfterMs, claimed.attempts),
      );
    }
    // This queue worker has no request context. Sawaa is single-tenant and RLS
    // has been removed; the direct transaction atomically fences the outcome.
    // eslint-disable-next-line no-restricted-syntax
    const applied = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationDelivery.updateMany({
        where: { id: claimed.id, status: 'SENDING', leaseToken: claimed.leaseToken },
        data,
      });
      if (updated.count !== 1) return false;
      if (claimed.attemptId) {
        const attemptUpdated = await tx.notificationDeliveryAttempt.updateMany({
          where: {
            id: claimed.attemptId,
            deliveryId: claimed.id,
            leaseToken: claimed.leaseToken,
          },
          data: {
            finishedAt: now,
            outcome: finalStatus,
            providerMessageId: result.providerMessageId,
            errorCode: this.safeErrorCode(result.errorCode),
          },
        });
        if (attemptUpdated.count !== 1) throw new Error('STALE_ATTEMPT_OWNER');
      }
      return true;
    });
    if (applied) {
      this.metrics?.recordAttempt(claimed.channel, finalStatus);
      if (finalStatus === 'UNKNOWN' || finalStatus === 'DEAD') {
        this.metrics?.recordTerminal(finalStatus);
      }
    }
  }

  private retryDelay(retryAfterMs: number | undefined, attemptNumber: number): number {
    const attempt = Math.max(1, attemptNumber);
    const base = NOTIFICATION_OUTBOX_RETRY_DELAYS_MS[Math.min(attempt - 1, NOTIFICATION_OUTBOX_RETRY_DELAYS_MS.length - 1)];
    const retryAfter = retryAfterMs && Number.isFinite(retryAfterMs) ? retryAfterMs : 0;
    const jitter = Math.floor(base * 0.1 * (Math.random() * 2 - 1));
    return Math.max(1_000, Math.min(Math.max(retryAfter, base + jitter), 86_400_000));
  }

  private safeReason(value: string): string {
    const allowed = new Set(Object.values(NOTIFICATION_OUTBOX_OUTCOME_REASONS));
    return allowed.has(value as never)
      ? value
      : NOTIFICATION_OUTBOX_OUTCOME_REASONS.AMBIGUOUS_PROVIDER_OUTCOME;
  }

  private safeErrorCode(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const allowed = new Set([
      'NO_PROVIDER',
      'INVALID_PAYLOAD',
      'UNSUPPORTED_CHANNEL',
      'RATE_LIMITED',
      'PROVIDER_ERROR',
      'PROVIDER_TIMEOUT',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
    ]);
    return allowed.has(value) ? value : 'PROVIDER_ERROR';
  }
}
