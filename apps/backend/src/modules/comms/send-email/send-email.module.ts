import { Module } from '@nestjs/common';
import { MessagingModule } from '../../../infrastructure/messaging.module';
import { SendEmailQueueService } from './send-email-queue.service';

/**
 * Standalone producer module for the transactional email queue.
 *
 * Auth flows (identity) enqueue email without importing the whole
 * CommsModule — importing CommsModule here created the module cycle
 * identity → comms → people → identity that forced forwardRef on both
 * ends (MNT-19.3). This module depends on infrastructure only, so it
 * is safe for identity to import directly.
 */
@Module({
  imports: [MessagingModule],
  providers: [SendEmailQueueService],
  exports: [SendEmailQueueService],
})
export class SendEmailQueueModule {}
