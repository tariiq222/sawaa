import { Module } from '@nestjs/common';
import { DashboardAiController } from '../../api/dashboard/ai.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { EmbedDocumentHandler } from './embed-document/embed-document.handler';
import { SemanticSearchHandler } from './semantic-search/semantic-search.handler';
import { ChatCompletionHandler } from './chat-completion/chat-completion.handler';
import { ManageKnowledgeBaseHandler } from './manage-knowledge-base/manage-knowledge-base.handler';
import { GetChatbotConfigHandler } from './chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from './chatbot-config/upsert-chatbot-config.handler';

const handlers = [
  EmbedDocumentHandler,
  SemanticSearchHandler,
  ChatCompletionHandler,
  ManageKnowledgeBaseHandler,
  GetChatbotConfigHandler,
  UpsertChatbotConfigHandler,
];

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardAiController],
  providers: handlers,
  exports: handlers,
})
export class AiModule {}
