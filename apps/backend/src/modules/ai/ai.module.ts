import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardAiController } from '../../api/dashboard/ai.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { EmbedDocumentHandler } from './embed-document/embed-document.handler';
import { SemanticSearchHandler } from './semantic-search/semantic-search.handler';
import { ChatCompletionHandler } from './chat-completion/chat-completion.handler';
import { ManageKnowledgeBaseHandler } from './manage-knowledge-base/manage-knowledge-base.handler';
import { GetChatbotConfigHandler } from './chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from './chatbot-config/upsert-chatbot-config.handler';
import { GetAiProviderConfigHandler } from './provider-config/get-ai-provider-config.handler';
import { UpsertAiProviderConfigHandler } from './provider-config/upsert-ai-provider-config.handler';
import { TestAiProviderConfigHandler } from './provider-config/test-ai-provider-config.handler';
import { AiInfraModule } from '../../infrastructure/ai';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { KnowledgeIndexingWorker } from './knowledge-indexing/knowledge-indexing.worker';

const handlers = [
  EmbedDocumentHandler,
  SemanticSearchHandler,
  ChatCompletionHandler,
  ManageKnowledgeBaseHandler,
  GetChatbotConfigHandler,
  UpsertChatbotConfigHandler,
  GetAiProviderConfigHandler,
  UpsertAiProviderConfigHandler,
  TestAiProviderConfigHandler,
  KnowledgeIndexingWorker,
];

@Module({
  imports: [DatabaseModule, AiInfraModule, MessagingModule],
  controllers: [DashboardAiController],
  providers: handlers,
  exports: handlers,
})
export class AiModule implements OnModuleInit {
  constructor(private readonly knowledgeIndexingWorker: KnowledgeIndexingWorker) {}

  onModuleInit(): void {
    this.knowledgeIndexingWorker.register();
  }
}
