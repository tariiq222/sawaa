import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, DeliveryType, ZoomMeetingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PrismaService } from '../../../infrastructure/database';
import {
  ZoomApiClient,
  type ZoomMeetingResponse,
  type ZoomMeetingState,
} from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';

export interface CreateZoomMeetingCommand {
  bookingId: string;
}

const LEASE_MS = 60_000;
const BEFORE_CALL = 'BEFORE_CALL';
const CALL_UNKNOWN = 'CALL_UNKNOWN';
const COMPLETED = 'COMPLETED';
const MANUAL_REVIEW = 'MANUAL_REVIEW';

@Injectable()
export class CreateZoomMeetingHandler {
  private readonly logger = new Logger(CreateZoomMeetingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomApi: ZoomApiClient,
    private readonly zoomCredentials: ZoomCredentialsService,
  ) {}

  async execute(cmd: CreateZoomMeetingCommand) {
    const initial = await this.prisma.booking.findFirst({ where: { id: cmd.bookingId } });
    if (!initial) throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    if (initial.deliveryType !== DeliveryType.ONLINE) {
      throw new BadRequestException('Zoom meetings can only be created for ONLINE delivery bookings');
    }
    // A durable outbox delivery may legitimately arrive after cancellation.
    // Never acquire a provider lease or create a remote meeting for a booking
    // that is no longer eligible for delivery.
    if (!this.isEligibleLifecycle(initial.status)) return initial;
    if (this.isCompleted(initial)) return initial;

    const leaseOwner = randomUUID();
    const now = new Date();
    const acquired = await this.prisma.booking.updateMany({
      where: {
        id: cmd.bookingId,
        OR: [
          { zoomCreateLeaseOwner: null },
          { zoomCreateLeaseExpiresAt: null },
          { zoomCreateLeaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        zoomCreateLeaseOwner: leaseOwner,
        zoomCreateLeaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        zoomCreateAttemptCount: { increment: 1 },
      },
    });
    if (acquired.count !== 1) {
      // Another durable worker owns the provider call. It is safe for this
      // duplicate delivery to acknowledge without touching Zoom.
      return this.requireBooking(cmd.bookingId);
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking) {
      await this.release(leaseOwner, cmd.bookingId, 'Booking disappeared after lease acquisition');
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (this.isCompleted(booking)) {
      await this.release(leaseOwner, cmd.bookingId);
      return booking;
    }
    if (!this.isEligibleLifecycle(booking.status)) {
      await this.release(leaseOwner, booking.id);
      return booking;
    }

    const integration = await this.prisma.integration.findFirst({ where: { provider: 'zoom' } });
    if (!integration?.isActive) {
      return this.manualReview(cmd.bookingId, leaseOwner, 'Zoom integration is not configured for this clinic');
    }
    const ciphertext = (integration.config as { ciphertext?: string } | null)?.ciphertext;
    if (!ciphertext) {
      return this.manualReview(cmd.bookingId, leaseOwner, 'Zoom integration configuration is invalid');
    }

    let credentials: { zoomClientId: string; zoomClientSecret: string; zoomAccountId: string };
    try {
      credentials = this.zoomCredentials.decrypt(ciphertext, DEFAULT_ORG_ID);
    } catch (error) {
      return this.manualReview(
        cmd.bookingId,
        leaseOwner,
        error instanceof Error ? error.message : 'Zoom integration configuration is invalid',
      );
    }

    let token: string;
    try {
      token = await this.zoomApi.getAccessToken(
        DEFAULT_ORG_ID,
        credentials.zoomClientId,
        credentials.zoomClientSecret,
        credentials.zoomAccountId,
      );
    } catch (error) {
      // OAuth happens before the meeting POST, so releasing BEFORE_CALL makes
      // a later retry safe.
      await this.release(
        leaseOwner,
        cmd.bookingId,
        error instanceof Error ? error.message : 'Zoom authentication failed',
      );
      throw error;
    }

    const settings = await this.prisma.organizationSettings.findFirst({ where: {} });
    const timezone = settings?.timezone || 'Asia/Riyadh';
    const topic = `Booking ${booking.id}`;

    if ((booking.zoomCreatePhase ?? BEFORE_CALL) === CALL_UNKNOWN) {
      return this.reconcileUnknown(booking, leaseOwner, token, topic, timezone);
    }
    if ((booking.zoomCreatePhase ?? BEFORE_CALL) === MANUAL_REVIEW) {
      await this.release(leaseOwner, booking.id);
      return this.requireBooking(booking.id);
    }

    const armed = await this.prisma.booking.updateMany({
      where: { id: booking.id, zoomCreateLeaseOwner: leaseOwner, zoomCreatePhase: BEFORE_CALL },
      data: { zoomCreatePhase: CALL_UNKNOWN, zoomMeetingStatus: ZoomMeetingStatus.PENDING, zoomMeetingError: null },
    });
    if (armed.count !== 1) {
      await this.release(leaseOwner, booking.id);
      throw new Error(`Lost Zoom creation lease for booking ${booking.id} before provider call`);
    }

    let meeting: ZoomMeetingResponse;
    try {
      // Exactly one POST. Once armed CALL_UNKNOWN, every replay is GET-only.
      meeting = await this.zoomApi.createMeeting(token, {
        topic,
        startTime: booking.scheduledAt.toISOString(),
        durationMins: booking.durationMins,
      }, timezone);
    } catch (error) {
      await this.release(
        leaseOwner,
        booking.id,
        error instanceof Error ? error.message : 'Unknown Zoom create outcome',
      );
      throw error;
    }

    return this.finalize(booking.id, leaseOwner, meeting);
  }

  private async reconcileUnknown(
    booking: { id: string; scheduledAt: Date; durationMins: number },
    leaseOwner: string,
    token: string,
    topic: string,
    timezone: string,
  ) {
    let meeting: (ZoomMeetingState & { join_url?: string; start_url?: string }) | null;
    try {
      meeting = await this.zoomApi.findMeetingByTopic(token, topic);
      if (!meeting) {
        return this.manualReview(
          booking.id,
          leaseOwner,
          'Zoom create outcome is unknown and no matching meeting is visible; do not retry POST',
        );
      }
      const desiredStart = booking.scheduledAt.toISOString();
      if (new Date(meeting.startTime).toISOString() !== desiredStart
        || meeting.durationMins !== booking.durationMins) {
        await this.zoomApi.updateMeeting(token, String(meeting.id), {
          topic,
          startTime: desiredStart,
          durationMins: booking.durationMins,
        }, timezone);
      }
    } catch (error) {
      await this.release(
        leaseOwner,
        booking.id,
        error instanceof Error ? error.message : 'Zoom reconciliation failed',
      );
      throw error;
    }
    return this.finalize(booking.id, leaseOwner, {
      id: meeting.id,
      join_url: meeting.join_url ?? '',
      start_url: meeting.start_url ?? '',
    });
  }

  private async finalize(bookingId: string, leaseOwner: string, meeting: ZoomMeetingResponse) {
    const finalized = await this.prisma.booking.updateMany({
      where: { id: bookingId, zoomCreateLeaseOwner: leaseOwner, zoomCreatePhase: CALL_UNKNOWN },
      data: {
        zoomMeetingId: String(meeting.id),
        zoomJoinUrl: meeting.join_url || null,
        zoomHostUrl: meeting.start_url || null,
        zoomStartUrl: meeting.start_url || null,
        zoomMeetingStatus: ZoomMeetingStatus.CREATED,
        zoomMeetingCreatedAt: new Date(),
        zoomMeetingError: null,
        zoomCreatePhase: COMPLETED,
        zoomCreateLeaseOwner: null,
        zoomCreateLeaseExpiresAt: null,
      },
    });
    if (finalized.count !== 1) {
      throw new Error(`Could not persist confirmed Zoom meeting for booking ${bookingId}`);
    }
    return this.requireBooking(bookingId);
  }

  private async manualReview(bookingId: string, leaseOwner: string, reason: string) {
    this.logger.error(`Booking ${bookingId} Zoom creation requires manual review: ${reason}`);
    await this.prisma.booking.updateMany({
      where: { id: bookingId, zoomCreateLeaseOwner: leaseOwner },
      data: {
        zoomMeetingStatus: ZoomMeetingStatus.FAILED,
        zoomMeetingError: reason,
        zoomCreatePhase: MANUAL_REVIEW,
        zoomCreateLeaseOwner: null,
        zoomCreateLeaseExpiresAt: null,
      },
    });
    return this.requireBooking(bookingId);
  }

  private async release(leaseOwner: string, bookingId: string, error?: string): Promise<void> {
    const released = await this.prisma.booking.updateMany({
      where: { id: bookingId, zoomCreateLeaseOwner: leaseOwner },
      data: {
        zoomCreateLeaseOwner: null,
        zoomCreateLeaseExpiresAt: null,
        ...(error ? { zoomMeetingError: error } : {}),
      },
    });
    if (released.count !== 1) {
      throw new Error(`Could not release Zoom creation lease for booking ${bookingId}`);
    }
  }

  private isCompleted(booking: { zoomMeetingId?: string | null; zoomMeetingStatus?: ZoomMeetingStatus | null; zoomCreatePhase?: string | null }): boolean {
    return Boolean(
      booking.zoomMeetingId
      && booking.zoomMeetingStatus === ZoomMeetingStatus.CREATED
      // Older rows predate zoomCreatePhase. CREATED + a durable meeting id is
      // already proof of completion and must never arm another POST.
    );
  }

  private isEligibleLifecycle(status: BookingStatus): boolean {
    return status === BookingStatus.PENDING
      || status === BookingStatus.CONFIRMED
      || status === BookingStatus.DEPOSIT_PAID;
  }

  private async requireBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    return booking;
  }
}
