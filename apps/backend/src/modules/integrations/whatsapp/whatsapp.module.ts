import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { WhatsappCredentialsService } from '../../../infrastructure/whatsapp/whatsapp-credentials.service';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';
import { WhatsappEvolutionConfigService } from '../../../infrastructure/whatsapp/whatsapp-evolution-config.service';
import { EvolutionUrlValidator } from '../../../infrastructure/whatsapp/evolution-url.validator';
import { GetWhatsappConfigHandler } from './get-whatsapp-config.handler';
import { UpsertWhatsappConfigHandler } from './upsert-whatsapp-config.handler';
import { TestWhatsappConfigHandler } from './test-whatsapp-config.handler';
import { ResetWhatsappConfigHandler } from './reset-whatsapp-config.handler';
import { UnlinkWhatsappHandler } from './unlink-whatsapp.handler';
import { GetWhatsappAgentConfigHandler } from '../../whatsapp-agent/agent-config/get-whatsapp-agent-config.handler';
import { UpsertWhatsappAgentConfigHandler } from '../../whatsapp-agent/agent-config/upsert-whatsapp-agent-config.handler';
import { GetWhatsappStatusHandler } from '../../whatsapp-agent/runtime/get-whatsapp-status.handler';
import { ControlWhatsappHandler } from '../../whatsapp-agent/runtime/control-whatsapp.handler';
import { GetWhatsappQrHandler } from '../../whatsapp-agent/runtime/get-whatsapp-qr.handler';
import { ListWhatsappConversationsHandler } from '../../whatsapp-agent/conversations/list-whatsapp-conversations.handler';
import { GetWhatsappConversationHandler } from '../../whatsapp-agent/conversations/get-whatsapp-conversation.handler';
import { StaffReplyHandler } from '../../whatsapp-agent/conversations/staff-reply.handler';
import { CloseWhatsappConversationHandler } from '../../whatsapp-agent/conversations/close-whatsapp-conversation.handler';
import { MarkWhatsappConversationReadHandler } from '../../whatsapp-agent/conversations/mark-whatsapp-conversation-read.handler';
import { ReleaseWhatsappTakeoverHandler } from '../../whatsapp-agent/conversations/release-whatsapp-takeover.handler';
import { BookingToolsService } from '../../whatsapp-agent/agent/booking-tools.service';
import { AgentLlmService } from '../../whatsapp-agent/agent/agent-llm.service';
import { AgentOrchestratorService } from '../../whatsapp-agent/agent/agent-orchestrator.service';
import { WhatsappIntegrationsController } from '../../../api/dashboard/whatsapp-integrations.controller';
import { WhatsappAgentController } from '../../../api/dashboard/whatsapp-agent.controller';
import { WhatsappWebhookController } from '../../../api/public/whatsapp-webhook.controller';
import { WhatsappWebhookVerifier } from './webhook/whatsapp-webhook-verifier';
import { AiInfraModule } from '../../../infrastructure/ai/ai.module';
import { MessagingModule } from '../../../infrastructure/messaging.module';
import { WhatsappInboundQueueService } from '../../../infrastructure/whatsapp/whatsapp-inbound-queue.service';
import { WhatsappInboundWorker } from '../../whatsapp-agent/inbound/whatsapp-inbound.worker';
import { BookingsModule } from '../../bookings/bookings.module';
import { PeopleModule } from '../../people/people.module';
import { SpecialistRegistryService } from '../../whatsapp-agent/agent/specialist-registry.service';
import { SyncWhatsappConfigOnStartupService } from './sync-whatsapp-config-on-startup.service';

@Module({
  imports: [DatabaseModule, AiInfraModule, MessagingModule, BookingsModule, PeopleModule],
  controllers: [
    WhatsappIntegrationsController,
    WhatsappAgentController,
    WhatsappWebhookController,
  ],
  providers: [
    // Configuration
    GetWhatsappConfigHandler,
    UpsertWhatsappConfigHandler,
    TestWhatsappConfigHandler,
    ResetWhatsappConfigHandler,
    UnlinkWhatsappHandler,
    SyncWhatsappConfigOnStartupService,
    // AI agent config
    GetWhatsappAgentConfigHandler,
    UpsertWhatsappAgentConfigHandler,
    // Runtime
    GetWhatsappStatusHandler,
    ControlWhatsappHandler,
    GetWhatsappQrHandler,
    // Conversations
    ListWhatsappConversationsHandler,
    GetWhatsappConversationHandler,
    StaffReplyHandler,
    CloseWhatsappConversationHandler,
    MarkWhatsappConversationReadHandler,
    ReleaseWhatsappTakeoverHandler,
    // Agent + tools
    BookingToolsService,
    AgentLlmService,
    AgentOrchestratorService,
    SpecialistRegistryService,
    WhatsappInboundWorker,
    // Infrastructure
    WhatsappCredentialsService,
    WhatsappEvolutionConfigService,
    WhatsappTransportService,
    EvolutionUrlValidator,
    WhatsappInboundQueueService,
    // Webhook security
    WhatsappWebhookVerifier,
  ],
  exports: [
    GetWhatsappConfigHandler,
    GetWhatsappAgentConfigHandler,
    GetWhatsappStatusHandler,
    ListWhatsappConversationsHandler,
    WhatsappCredentialsService,
    WhatsappEvolutionConfigService,
    WhatsappTransportService,
    EvolutionUrlValidator,
    WhatsappWebhookVerifier,
  ],
})
export class WhatsappModule {}
