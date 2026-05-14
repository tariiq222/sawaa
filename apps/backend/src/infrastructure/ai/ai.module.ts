import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { aiConfig } from './ai.config';
import { EmbeddingAdapter } from './embedding.adapter';
import { ChatAdapter } from './chat.adapter';

@Global()
@Module({
  imports: [ConfigModule.forFeature(aiConfig)],
  providers: [EmbeddingAdapter, ChatAdapter],
  exports: [EmbeddingAdapter, ChatAdapter],
})
export class AiInfraModule {}
