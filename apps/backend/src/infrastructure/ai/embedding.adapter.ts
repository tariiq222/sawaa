import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AiConfig } from './ai.config';

export interface IEmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
  isAvailable(): boolean;
}

@Injectable()
export class EmbeddingAdapter implements IEmbeddingService, OnModuleInit {
  private readonly logger = new Logger(EmbeddingAdapter.name);
  private client?: OpenAI;
  private model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<AiConfig>('ai')!.embeddingModel;
  }

  onModuleInit(): void {
    const apiKey = this.config.get<AiConfig>('ai')!.openaiApiKey;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — EmbeddingAdapter disabled');
      return;
    }
    this.client = new OpenAI({ apiKey });
    this.logger.log(`EmbeddingAdapter ready (model: ${this.model})`);
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) throw new Error('EmbeddingAdapter is not available — set OPENAI_API_KEY');
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}
