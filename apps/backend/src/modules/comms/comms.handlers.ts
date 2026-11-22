/**
 * The comms provider rosters, kept out of `comms.module.ts` so the module file
 * stays inside the 120-line budget (MNT-20). Registration order is unchanged.
 */
import { AdministrativeAssistantLeaseService } from './chat/assistant/administrative-assistant-lease.service';
import { AdministrativeAssistantRecoveryWorker } from './chat/assistant/administrative-assistant-recovery.worker';
import { AdministrativeAssistantService } from './chat/assistant/administrative-assistant.service';
import { AdministrativeOutputValidator } from './chat/assistant/administrative-output-validator';
import { AdministrativeResponseRenderer } from './chat/assistant/administrative-response-renderer';
import { AdministrativeScopeGate } from './chat/assistant/administrative-scope-gate';
import { AdministrativeToolsService } from './chat/assistant/administrative-tools.service';
import { OnAdministrativeMessageProcessingRequestedHandler } from './chat/assistant/on-administrative-message-processing-requested.handler';
import { RetryAdministrativeMessageHandler } from './chat/assistant/retry-administrative-message.handler';
import { ChatAuditService } from './chat/chat-audit.service';
import { ChatUsageLimitsService } from './chat/chat-usage-limits.service';
import { CloseConversationHandler } from './chat/close-conversation.handler';
import { CloseConversationHandler as CloseStaffConversationHandler } from './chat/staff/close-conversation.handler';
import { CreateChatMessageHandler } from './chat/create-chat-message.handler';
import { CreateConversationHandler } from './chat/create-conversation.handler';
import { GetConversationHandler } from './chat/get-conversation.handler';
import { GetConversationHandler as GetStaffConversationHandler } from './chat/staff/get-conversation.handler';
import { ChatAccessService } from './chat/guest/chat-access.service';
import { ClaimConversationHandler } from './chat/guest/claim-conversation.handler';
import { ClaimConversationHandler as ClaimStaffConversationHandler } from './chat/staff/claim-conversation.handler';
import { CreateGuestConversationHandler } from './chat/guest/create-conversation.handler';
import { GetCurrentConversationHandler } from './chat/guest/get-current-conversation.handler';
import { GuestChatTokenService } from './chat/guest/guest-chat-token.service';
import { ListConversationsHandler } from './chat/list-conversations.handler';
import { ListMessagesHandler } from './chat/list-messages.handler';
import { GetClientChatConversationHandler } from './chat/messages/get-client-chat-conversation.handler';
import { ListChatMessagesHandler } from './chat/messages/list-chat-messages.handler';
import { ListClientChatConversationsHandler } from './chat/messages/list-client-chat-conversations.handler';
import { SendChatMessageHandler } from './chat/messages/send-chat-message.handler';
import { AcknowledgeExistingBookingHandler } from './chat/operations/acknowledge-existing-booking.handler';
import { ChatBookingQuoteService } from './chat/operations/chat-booking-quote.service';
import { ConfirmOperationHandler } from './chat/operations/confirm-operation.handler';
import { DeclineOperationHandler } from './chat/operations/decline-operation.handler';
import { ListOwnAppointmentsHandler } from './chat/operations/list-own-appointments.handler';
import { OnChatOperationsResumeRequestedHandler } from './chat/operations/on-chat-operations-resume-requested.handler';
import { PrepareBookingHandler } from './chat/operations/prepare-booking.handler';
import { PrepareCancellationHandler } from './chat/operations/prepare-cancellation.handler';
import { PrepareRescheduleHandler } from './chat/operations/prepare-reschedule.handler';
import { ResumeChatOperationsHandler } from './chat/operations/resume-chat-operations.handler';
import { SendStaffMessageHandler } from './chat/send-staff-message.handler';
import { AssignConversationHandler } from './chat/staff/assign-conversation.handler';
import { ListConversationMessagesHandler } from './chat/staff/list-conversation-messages.handler';
import { ListInboxHandler } from './chat/staff/list-inbox.handler';
import { MarkConversationReadHandler } from './chat/staff/mark-conversation-read.handler';
import { ReleaseConversationHandler } from './chat/staff/release-conversation.handler';
import { ReplyConversationHandler } from './chat/staff/reply-conversation.handler';
import { RequestHandoffHandler } from './chat/staff/request-handoff.handler';
import { StaffConversationAccessService } from './chat/staff/staff-conversation-access.service';
import { WebChatAvailabilityService, WebChatEnabledGuard } from './chat/web-chat-availability.service';
import { CreateContactMessageHandler } from './contact-messages/create-contact-message.handler';
import { ListContactMessagesHandler } from './contact-messages/list-contact-messages.handler';
import { UpdateContactMessageStatusHandler } from './contact-messages/update-contact-message-status.handler';
import { CreateEmailTemplateHandler } from './email-templates/create-email-template.handler';
import { GetEmailTemplateHandler } from './email-templates/get-email-template.handler';
import { ListEmailTemplatesHandler } from './email-templates/list-email-templates.handler';
import { PreviewEmailTemplateHandler } from './email-templates/preview-email-template.handler';
import { UpdateEmailTemplateHandler } from './email-templates/update-email-template.handler';
import { OnBookingCancelledStaffHandler } from './events/on-booking-cancelled-staff.handler';
import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingCreatedStaffHandler } from './events/on-booking-created-staff.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnClientEnrolledStaffHandler } from './events/on-client-enrolled-staff.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';
import { OnPaymentCompletedStaffHandler } from './events/on-payment-completed-staff.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnRefundOutcomeHandler } from './events/on-refund-outcome.handler';
import { GetClientPushTargetsHandler } from './fcm-tokens/get-client-push-targets.handler';
import { RegisterFcmTokenHandler } from './fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from './fcm-tokens/unregister-fcm-token.handler';
import { ListSmsDeliveriesHandler } from './list-sms-deliveries/list-sms-deliveries.handler';
import { ListTenantDeliveryLogsHandler } from './list-tenant-delivery-logs/list-tenant-delivery-logs.handler';
import { CreateNotificationHandler } from './notifications/create-notification.handler';
import { GetStaffTargetsHandler } from './notifications/get-staff-targets.handler';
import { GetUnreadCountHandler } from './notifications/get-unread-count.handler';
import { ListNotificationsHandler } from './notifications/list-notifications.handler';
import { MarkReadHandler } from './notifications/mark-read.handler';
import { GetOrgEmailConfigHandler } from './org-email-config/get-org-email-config.handler';
import { TestEmailConfigHandler } from './org-email-config/test-email-config.handler';
import { UpsertOrgEmailConfigHandler } from './org-email-config/upsert-org-email-config.handler';
import { GetOrgSmsConfigHandler } from './org-sms-config/get-org-sms-config.handler';
import { TestSmsConfigHandler } from './org-sms-config/test-sms-config.handler';
import { UpsertOrgSmsConfigHandler } from './org-sms-config/upsert-org-sms-config.handler';
import { NotificationRetryWorker } from './resilient-notification-dispatcher/notification-retry-worker';
import { ResilientNotificationDispatcher } from './resilient-notification-dispatcher/resilient-notification-dispatcher.service';
import { SendEmailQueueService } from './send-email/send-email-queue.service';
import { SendEmailWorker } from './send-email/send-email-worker';
import { SendEmailHandler } from './send-email/send-email.handler';
import { SendNotificationHandler } from './send-notification/send-notification.handler';
import { SendPushHandler } from './send-push/send-push.handler';
import { SendSmsHandler } from './send-sms/send-sms.handler';
import { SmsDlrHandler } from './sms-dlr/sms-dlr.handler';

export const handlers = [
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
  GuestChatTokenService,
  ChatAuditService,
  ChatUsageLimitsService,
  WebChatAvailabilityService,
  WebChatEnabledGuard,
  ChatAccessService,
  CreateGuestConversationHandler,
  GetCurrentConversationHandler,
  ClaimConversationHandler,
  SendChatMessageHandler,
  ListChatMessagesHandler,
  ListClientChatConversationsHandler,
  GetClientChatConversationHandler,
  AdministrativeAssistantService,
  RetryAdministrativeMessageHandler,
  AdministrativeToolsService,
  AdministrativeAssistantLeaseService,
  AdministrativeScopeGate,
  AdministrativeOutputValidator,
  AdministrativeResponseRenderer,
  RequestHandoffHandler,
  ClaimStaffConversationHandler,
  AssignConversationHandler,
  ReleaseConversationHandler,
  CloseStaffConversationHandler,
  MarkConversationReadHandler,
  ReplyConversationHandler,
  ListInboxHandler,
  GetStaffConversationHandler,
  ListConversationMessagesHandler,
  StaffConversationAccessService,
  ChatBookingQuoteService,
  PrepareBookingHandler,
  PrepareRescheduleHandler,
  PrepareCancellationHandler,
  ListOwnAppointmentsHandler,
  AcknowledgeExistingBookingHandler,
  ConfirmOperationHandler,
  DeclineOperationHandler,
  ResumeChatOperationsHandler,
  OnChatOperationsResumeRequestedHandler,
  OnAdministrativeMessageProcessingRequestedHandler,
  AdministrativeAssistantRecoveryWorker,
];

export const eventHandlers = [
  OnBookingCancelledHandler,
  OnRefundOutcomeHandler,
  OnBookingReminderHandler,
  OnPaymentFailedHandler,
  OnClientEnrolledHandler,
  OnBookingCreatedStaffHandler,
  OnBookingCancelledStaffHandler,
  OnPaymentCompletedStaffHandler,
  OnClientEnrolledStaffHandler,
];
