import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';

interface ClientEnrolledPayload {
  clientId: string;
  name: string;
  phone?: string;
  email?: string;
}

@Injectable()
export class OnClientEnrolledHandler {
  private readonly logger = new Logger(OnClientEnrolledHandler.name);

  constructor(private readonly notify: SendNotificationHandler) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<ClientEnrolledPayload>('people.client.enrolled', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<ClientEnrolledPayload>): Promise<void> {
    const { payload } = envelope;
    try {
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.WELCOME,
        title: 'مرحباً بك!',
        body: `أهلاً ${payload.name}، يسعدنا انضمامك إلينا.`,
        channels: ['in-app', 'email'],
        recipientEmail: payload.email,
        emailTemplateSlug: 'welcome',
        emailVars: { client_name: payload.name },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle client enrolled for client ${payload.clientId}`,
        err,
      );
    }
  }
}
