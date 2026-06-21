import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardCommsController } from '../../api/dashboard/comms.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { EventBusService } from '../../infrastructure/events';
import { SendPushHandler } from './send-push/send-push.handler';
import { SendSmsHandler } from './send-sms/send-sms.handler';
import { SendEmailHandler } from './send-email/send-email.handler';
import { SendEmailQueueService } from './send-email/send-email-queue.service';
import { SendEmailWorker } from './send-email/send-email-worker';
import { SendNotificationHandler } from './send-notification/send-notification.handler';
import { CreateNotificationHandler } from './notifications/create-notification.handler';
import { ListNotificationsHandler } from './notifications/list-notifications.handler';
import { GetUnreadCountHandler } from './notifications/get-unread-count.handler';
import { MarkReadHandler } from './notifications/mark-read.handler';
import { CreateConversationHandler } from './chat/create-conversation.handler';
import { CreateChatMessageHandler } from './chat/create-chat-message.handler';
import { ListConversationsHandler } from './chat/list-conversations.handler';
import { ListMessagesHandler } from './chat/list-messages.handler';
import { GetConversationHandler } from './chat/get-conversation.handler';
import { CloseConversationHandler } from './chat/close-conversation.handler';
import { SendStaffMessageHandler } from './chat/send-staff-message.handler';
import { CreateEmailTemplateHandler } from './email-templates/create-email-template.handler';
import { UpdateEmailTemplateHandler } from './email-templates/update-email-template.handler';
import { GetEmailTemplateHandler } from './email-templates/get-email-template.handler';
import { ListEmailTemplatesHandler } from './email-templates/list-email-templates.handler';
import { PreviewEmailTemplateHandler } from './email-templates/preview-email-template.handler';
import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';
import { CreateContactMessageHandler } from './contact-messages/create-contact-message.handler';
import { ListContactMessagesHandler } from './contact-messages/list-contact-messages.handler';
import { UpdateContactMessageStatusHandler } from './contact-messages/update-contact-message-status.handler';
import { NotificationChannelModule } from './notification-channel/notification-channel.module';
import { SmsModule } from '../../infrastructure/sms/sms.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { GetOrgSmsConfigHandler } from './org-sms-config/get-org-sms-config.handler';
import { UpsertOrgSmsConfigHandler } from './org-sms-config/upsert-org-sms-config.handler';
import { TestSmsConfigHandler } from './org-sms-config/test-sms-config.handler';
import { GetOrgEmailConfigHandler } from './org-email-config/get-org-email-config.handler';
import { UpsertOrgEmailConfigHandler } from './org-email-config/upsert-org-email-config.handler';
import { TestEmailConfigHandler } from './org-email-config/test-email-config.handler';
import { SmsDlrHandler } from './sms-dlr/sms-dlr.handler';
import { RegisterFcmTokenHandler } from './fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from './fcm-tokens/unregister-fcm-token.handler';
import { GetClientPushTargetsHandler } from './fcm-tokens/get-client-push-targets.handler';
import { GetStaffTargetsHandler } from './notifications/get-staff-targets.handler';
import { OnBookingCreatedStaffHandler } from './events/on-booking-created-staff.handler';
import { OnBookingCancelledStaffHandler } from './events/on-booking-cancelled-staff.handler';
import { OnPaymentCompletedStaffHandler } from './events/on-payment-completed-staff.handler';
import { OnClientEnrolledStaffHandler } from './events/on-client-enrolled-staff.handler';
import { ResilientNotificationDispatcher } from './resilient-notification-dispatcher/resilient-notification-dispatcher.service';
import { NotificationRetryWorker } from './resilient-notification-dispatcher/notification-retry-worker';
import { ListTenantDeliveryLogsHandler } from './list-tenant-delivery-logs/list-tenant-delivery-logs.handler';
import { ListSmsDeliveriesHandler } from './list-sms-deliveries/list-sms-deliveries.handler';

const handlers = [
  SendPushHandler,
  SendSmsHandler,
  SendEmailHandler,
  SendEmailQueueService,
  SendEmailWorker,
  GetOrgSmsConfigHandler,
  UpsertOrgSmsConfigHandler,
  TestSmsConfigHandler,
  GetOrgEmailConfigHandler,
  UpsertOrgEmailConfigHandler,
  TestEmailConfigHandler,
  SmsDlrHandler,
  SendNotificationHandler,
  CreateNotificationHandler,
  ListNotificationsHandler,
  GetUnreadCountHandler,
  MarkReadHandler,
  CreateConversationHandler,
  CreateChatMessageHandler,
  ListConversationsHandler,
  ListMessagesHandler,
  GetConversationHandler,
  CloseConversationHandler,
  SendStaffMessageHandler,
  CreateEmailTemplateHandler,
  UpdateEmailTemplateHandler,
  GetEmailTemplateHandler,
  ListEmailTemplatesHandler,
  PreviewEmailTemplateHandler,
  CreateContactMessageHandler,
  ListContactMessagesHandler,
  UpdateContactMessageStatusHandler,
  RegisterFcmTokenHandler,
  UnregisterFcmTokenHandler,
  GetClientPushTargetsHandler,
  GetStaffTargetsHandler,
  ResilientNotificationDispatcher,
  NotificationRetryWorker,
  ListTenantDeliveryLogsHandler,
  ListSmsDeliveriesHandler,
];

const eventHandlers = [
  OnBookingCancelledHandler,
  OnBookingReminderHandler,
  OnPaymentFailedHandler,
  OnClientEnrolledHandler,
  OnBookingCreatedStaffHandler,
  OnBookingCancelledStaffHandler,
  OnPaymentCompletedStaffHandler,
  OnClientEnrolledStaffHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, MailModule, NotificationChannelModule, SmsModule, EmailModule, ],
  controllers: [DashboardCommsController],
  providers: [...handlers, ...eventHandlers],
  exports: [...handlers, NotificationChannelModule],
})
export class CommsModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly onBookingCancelled: OnBookingCancelledHandler,
    private readonly onBookingReminder: OnBookingReminderHandler,
    private readonly onPaymentFailed: OnPaymentFailedHandler,
    private readonly onClientEnrolled: OnClientEnrolledHandler,
    private readonly onBookingCreatedStaff: OnBookingCreatedStaffHandler,
    private readonly onBookingCancelledStaff: OnBookingCancelledStaffHandler,
    private readonly onPaymentCompletedStaff: OnPaymentCompletedStaffHandler,
    private readonly onClientEnrolledStaff: OnClientEnrolledStaffHandler,
  ) {}

  onModuleInit(): void {
    this.onBookingCancelled.register(this.eventBus);
    this.onBookingReminder.register(this.eventBus);
    this.onPaymentFailed.register(this.eventBus);
    this.onClientEnrolled.register(this.eventBus);
    this.onBookingCreatedStaff.register(this.eventBus);
    this.onBookingCancelledStaff.register(this.eventBus);
    this.onPaymentCompletedStaff.register(this.eventBus);
    this.onClientEnrolledStaff.register(this.eventBus);
  }
}
