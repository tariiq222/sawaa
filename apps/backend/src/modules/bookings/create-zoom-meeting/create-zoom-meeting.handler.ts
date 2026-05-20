import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { ZoomMeetingStatus } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface CreateZoomMeetingCommand {
  bookingId: string;
}

/** FNV-1a 32-bit hash → signed int32 (Postgres int4 range) */
function hashToInt32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h | 0;
}

@Injectable()
export class CreateZoomMeetingHandler {
  private readonly logger = new Logger(CreateZoomMeetingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly zoomApi: ZoomApiClient,
    private readonly zoomCredentials: ZoomCredentialsService,
  ) {}

  async execute(cmd: CreateZoomMeetingCommand) {
    // Step 1: initial read outside tx — needed to derive the lock key
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    // Step 2: delivery-type validation — Zoom is only for ONLINE delivery
    if (booking.deliveryType !== 'ONLINE') {
      throw new BadRequestException(
        'Zoom meetings can only be created for ONLINE delivery bookings',
      );
    }

    const key1 = hashToInt32(DEFAULT_ORG_ID);
    const key2 = hashToInt32(booking.id);

    // Step 3: advisory-locked critical section
    return this.rlsTransaction.withTransaction(async (tx) => {
      // Acquire per-(org, booking) advisory lock before any read/write
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::int, ${key2}::int)`;

      // Re-read booking now that lock is held
      const freshBooking = await tx.booking.findFirst({
        where: { id: cmd.bookingId },
      });
      if (!freshBooking) {
        throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
      }

      // Idempotency check on freshly-read booking
      if (
        freshBooking.zoomMeetingId &&
        freshBooking.zoomMeetingStatus === ZoomMeetingStatus.CREATED
      ) {
        return freshBooking;
      }

      // Load zoom integration inside tx
      const integration = await tx.integration.findFirst({
        where: { provider: 'zoom' },
      });
      if (!integration || !integration.isActive) {
        this.logger.warn(`Zoom integration not configured for booking ${freshBooking.id}`);
        return tx.booking.update({
          where: { id: cmd.bookingId },
          data: {
            zoomMeetingStatus: ZoomMeetingStatus.FAILED,
            zoomMeetingError: 'Zoom integration is not configured for this clinic',
          },
        });
      }

      // Ciphertext validation
      const config = integration.config as { ciphertext?: string } | null;
      const ciphertext = config?.ciphertext;

      if (!ciphertext) {
        this.logger.error(`Zoom config missing ciphertext for org ${DEFAULT_ORG_ID}`);
        return tx.booking.update({
          where: { id: cmd.bookingId },
          data: {
            zoomMeetingStatus: ZoomMeetingStatus.FAILED,
            zoomMeetingError: 'Zoom integration configuration is invalid',
          },
        });
      }

      // Decrypt → token → createMeeting → update
      try {
        const { zoomClientId, zoomClientSecret, zoomAccountId } =
          this.zoomCredentials.decrypt<{
            zoomClientId: string;
            zoomClientSecret: string;
            zoomAccountId: string;
          }>(ciphertext, DEFAULT_ORG_ID);

        const settings = await tx.organizationSettings.findFirst({
          where: {},
        });
        const timezone = settings?.timezone || 'Asia/Riyadh';

        const token = await this.zoomApi.getAccessToken(
          DEFAULT_ORG_ID,
          zoomClientId,
          zoomClientSecret,
          zoomAccountId,
        );

        const meeting = await this.zoomApi.createMeeting(
          token,
          {
            topic: `Booking ${freshBooking.id}`,
            startTime: freshBooking.scheduledAt.toISOString(),
            durationMins: freshBooking.durationMins,
          },
          timezone,
        );

        return await tx.booking.update({
          where: { id: cmd.bookingId },
          data: {
            zoomMeetingId: String(meeting.id),
            zoomJoinUrl: meeting.join_url,
            zoomHostUrl: meeting.start_url,
            zoomStartUrl: meeting.start_url,
            zoomMeetingStatus: ZoomMeetingStatus.CREATED,
            zoomMeetingCreatedAt: new Date(),
            zoomMeetingError: null,
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        this.logger.error(
          `Failed to create Zoom meeting for booking ${freshBooking.id}: ${message}`,
        );
        return await tx.booking.update({
          where: { id: cmd.bookingId },
          data: {
            zoomMeetingStatus: ZoomMeetingStatus.FAILED,
            zoomMeetingError: message,
          },
        });
      }
    });
  }
}
