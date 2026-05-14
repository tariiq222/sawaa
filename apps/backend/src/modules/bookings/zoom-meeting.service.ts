import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';
import { ZoomApiClient } from '../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../infrastructure/zoom/zoom-credentials.service';

@Injectable()
export class ZoomMeetingService {
  private readonly logger = new Logger(ZoomMeetingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomApi: ZoomApiClient,
    private readonly zoomCredentials: ZoomCredentialsService,
  ) {}

  async getAccessToken(organizationId: string): Promise<string | null> {
    const integration = await this.prisma.integration.findFirst({
      where: { provider: 'zoom' },
    });
    if (!integration || !integration.isActive) return null;

    const config = integration.config as { ciphertext?: string } | null;
    const ciphertext = config?.ciphertext;
    if (!ciphertext) return null;

    try {
      const { zoomClientId, zoomClientSecret, zoomAccountId } =
        this.zoomCredentials.decrypt<{
          zoomClientId: string;
          zoomClientSecret: string;
          zoomAccountId: string;
        }>(ciphertext, organizationId);

      return await this.zoomApi.getAccessToken(
        organizationId,
        zoomClientId,
        zoomClientSecret,
        zoomAccountId,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Failed to get Zoom access token for org ${organizationId}: ${message}`);
      return null;
    }
  }

  async deleteMeeting(organizationId: string, meetingId: string): Promise<void> {
    const token = await this.getAccessToken(organizationId);
    if (!token) return;

    try {
      await this.zoomApi.deleteMeeting(token, meetingId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Failed to delete Zoom meeting ${meetingId}: ${message}`);
    }
  }

  async updateMeeting(
    organizationId: string,
    meetingId: string,
    opts: { topic: string; startTime: string; durationMins: number },
  ): Promise<void> {
    const token = await this.getAccessToken(organizationId);
    if (!token) return;

    try {
      const settings = await this.prisma.organizationSettings.findFirst({
        where: { organizationId },
      });
      const timezone = settings?.timezone || 'Asia/Riyadh';

      await this.zoomApi.updateMeeting(token, meetingId, opts, timezone);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Failed to update Zoom meeting ${meetingId}: ${message}`);
    }
  }
}
