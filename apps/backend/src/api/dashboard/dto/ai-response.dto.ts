import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /dashboard/ai/chat`
 * (`ChatCompletionHandler.execute` → `ChatCompletionResult`).
 *
 * Documentation only: the handler keeps its inferred return type and nothing
 * under `src/modules/**` imports this layer. `sessionId` is the chat session
 * the reply belongs to; no provider credential, key or prompt is returned.
 */
export class AiChatCompletionResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Chat session UUID holding the conversation history (created on the first message)',
    example: '00000000-0000-4000-a000-000000000010',
  })
  sessionId!: string;

  @ApiProperty({
    description: 'Assistant reply text',
    example: 'نعمل من الأحد إلى الخميس، من ٩ صباحًا حتى ٥ مساءً.',
  })
  reply!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Number of knowledge-base chunks used to ground the reply',
    example: 3,
  })
  sourcesUsed!: number;
}
