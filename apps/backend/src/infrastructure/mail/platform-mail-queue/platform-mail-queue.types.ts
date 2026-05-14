// Shared types + constants for the platform-mail BullMQ queue.

export const PLATFORM_MAIL_QUEUE = 'platform-mail';

export interface PlatformMailJobData {
  /** ID of the PlatformMailDeliveryLog row created at enqueue time. */
  logId: string;
  recipient: string;
  /** Identifier of the template (e.g., `tenant-welcome`, `trial-ending`). */
  templateName: string;
  subject: string;
  html: string;
  /** Pre-resolved `from` header (Resend `from` field). */
  from: string;
}

/** Payload accepted by `PlatformMailQueueService.enqueue()`. */
export interface PlatformMailEnqueuePayload {
  recipient: string;
  templateName: string;
  subject: string;
  html: string;
  from: string;
}
