import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { CreateContactMessageDto } from './create-contact-message.dto';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'] as const;

@Injectable()
export class CreateContactMessageHandler {
  private readonly logger = new Logger(CreateContactMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: SendNotificationHandler,
    private readonly staffTargets: GetStaffTargetsHandler,
  ) {}

  async execute(dto: CreateContactMessageDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required');
    }

    const message = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
      },
      select: { id: true, createdAt: true, status: true },
    });

    await this.notifyStaff(message.id);

    return message;
  }

  /**
   * Best-effort in-app notification fanout to active staff. Failures are
   * logged using only the contact message id — never the contact content —
   * and never propagate to the caller.
   */
  private async notifyStaff(contactMessageId: string): Promise<void> {
    try {
      const targets = await this.staffTargets.execute({
        organizationId: DEFAULT_ORG_ID,
        roles: [...STAFF_ROLES],
      });

      const results = await Promise.allSettled(
        targets.map((target) =>
          this.notify.execute({
            organizationId: DEFAULT_ORG_ID,
            recipientId: target.userId,
            recipientType: RecipientType.EMPLOYEE,
            type: NotificationType.GENERAL,
            title: 'رسالة تواصل جديدة',
            body: 'تم استلام رسالة جديدة عبر الموقع',
            channels: ['in-app'],
            metadata: { contactMessageId },
          }),
        ),
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        // Aggregate only — never include rejection reasons, which could
        // contain provider data.
        this.logger.warn(
          `Contact message ${contactMessageId}: ${failedCount} of ${results.length} staff notification(s) failed`,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to notify staff for contact message ${contactMessageId}`, err);
    }
  }
}
