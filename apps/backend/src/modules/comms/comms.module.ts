import { OnRefundOutcomeHandler } from './events/on-refund-outcome.handler';
import { Module, OnModuleInit } from '@nestjs/common';
import { handlers, eventHandlers } from './comms.handlers';
import { DashboardCommsController } from '../../api/dashboard/comms.controller';
import { DashboardCommsInboxController } from '../../api/dashboard/comms-inbox.controller';
import { DashboardCommsEmailTemplatesController } from '../../api/dashboard/comms-email-templates.controller';
import { DashboardCommsChatController } from '../../api/dashboard/comms-chat.controller';
import { DashboardConversationsController } from '../../api/dashboard/conversations.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { EventBusService } from '../../infrastructure/events';
import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';
import { NotificationChannelModule } from './notification-channel/notification-channel.module';
import { SmsModule } from '../../infrastructure/sms/sms.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { OnBookingCreatedStaffHandler } from './events/on-booking-created-staff.handler';
import { OnBookingCancelledStaffHandler } from './events/on-booking-cancelled-staff.handler';
import { OnPaymentCompletedStaffHandler } from './events/on-payment-completed-staff.handler';
import { OnClientEnrolledStaffHandler } from './events/on-client-enrolled-staff.handler';
import { AiModule } from '../ai/ai.module';
import { BookingsModule } from '../bookings/bookings.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { PeopleModule } from '../people/people.module';
import { SendEmailQueueModule } from './send-email/send-email.module';
import { OnChatOperationsResumeRequestedHandler } from './chat/operations/on-chat-operations-resume-requested.handler';
import { OnAdministrativeMessageProcessingRequestedHandler } from './chat/assistant/on-administrative-message-processing-requested.handler';
import { NotificationOutboxModule } from './notification-outbox/notification-outbox.module';

@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    MailModule,
    NotificationChannelModule,
    SmsModule,
    EmailModule,
    AiModule,
    SendEmailQueueModule,
    BookingsModule,
    OrgExperienceModule,
    PeopleModule,
    NotificationOutboxModule,
  ],
  controllers: [
    DashboardCommsController,
    DashboardCommsInboxController,
    DashboardCommsEmailTemplatesController,
    DashboardCommsChatController,
    DashboardConversationsController,
  ],
  providers: [...handlers, ...eventHandlers],
  exports: [...handlers, NotificationChannelModule],
})
export class CommsModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly onRefundOutcome: OnRefundOutcomeHandler,
    private readonly onBookingCancelled: OnBookingCancelledHandler,
    private readonly onBookingReminder: OnBookingReminderHandler,
    private readonly onPaymentFailed: OnPaymentFailedHandler,
    private readonly onClientEnrolled: OnClientEnrolledHandler,
    private readonly onBookingCreatedStaff: OnBookingCreatedStaffHandler,
    private readonly onBookingCancelledStaff: OnBookingCancelledStaffHandler,
    private readonly onPaymentCompletedStaff: OnPaymentCompletedStaffHandler,
    private readonly onClientEnrolledStaff: OnClientEnrolledStaffHandler,
    private readonly onChatOperationsResumeRequested: OnChatOperationsResumeRequestedHandler,
    private readonly onAdministrativeMessageProcessingRequested: OnAdministrativeMessageProcessingRequestedHandler,
  ) {}

  onModuleInit(): void {
    this.onBookingCancelled.register(this.eventBus);
    this.onRefundOutcome.register(this.eventBus);
    this.onBookingReminder.register(this.eventBus);
    this.onPaymentFailed.register(this.eventBus);
    this.onClientEnrolled.register(this.eventBus);
    this.onBookingCreatedStaff.register(this.eventBus);
    this.onBookingCancelledStaff.register(this.eventBus);
    this.onPaymentCompletedStaff.register(this.eventBus);
    this.onClientEnrolledStaff.register(this.eventBus);
    this.onChatOperationsResumeRequested.register();
    this.onAdministrativeMessageProcessingRequested.register();
  }
}
