import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { aiConfig } from './ai.config';
import { EmbeddingAdapter } from './embedding.adapter';
import { ChatAdapter } from './chat.adapter';
import { AiProviderCredentialsService } from './ai-provider-credentials.service';
import { AiProviderClientService } from './ai-provider-client.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(aiConfig)],
  providers: [EmbeddingAdapter, AiProviderCredentialsService, AiProviderClientService, ChatAdapter],
  exports: [EmbeddingAdapter, AiProviderCredentialsService, AiProviderClientService, ChatAdapter],
})
export class AiInfraModule {}
