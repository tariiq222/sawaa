import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

interface ClientEnrolledPayload {
  clientId: string;
  name: string;
  phone?: string;
  email?: string;
  organizationId?: string;
}

@Injectable()
export class OnClientEnrolledStaffHandler {
  private readonly logger = new Logger(OnClientEnrolledStaffHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly staffTargets: GetStaffTargetsHandler,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<ClientEnrolledPayload>('people.client.enrolled', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<ClientEnrolledPayload>): Promise<void> {
    const { payload } = envelope;
    if (!payload.organizationId) return;
    try {
      const targets = await this.staffTargets.execute({
        organizationId: payload.organizationId,
        roles: ['OWNER', 'ADMIN'],
      });

      await Promise.allSettled(
        targets.map((target) =>
          this.notify.execute({
            organizationId: payload.organizationId!,
            recipientId: target.userId,
            recipientType: RecipientType.EMPLOYEE,
            type: NotificationType.WELCOME,
            title: 'عميل جديد',
            body: `انضم عميل جديد: ${payload.name}`,
            channels: ['in-app'],
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to handle staff client.enrolled for client ${payload.clientId}`, err);
    }
  }
}
