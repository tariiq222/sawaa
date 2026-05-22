import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { ChatCompletionHandler } from '../../../modules/ai/chat-completion/chat-completion.handler';
import { ListConversationsHandler } from '../../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../../modules/comms/chat/list-messages.handler';

export class MobileChatBody {
  @ApiProperty({ description: 'The message text sent by the client', example: 'What are your opening hours?' })
  @IsString() userMessage!: string;

  @ApiPropertyOptional({ description: 'Existing chat session UUID to continue', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() sessionId?: string;
}

export class MobileListConversationsQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class MobileListMessagesQuery {
  @ApiPropertyOptional({ description: 'Cursor (message UUID) for keyset pagination', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() cursor?: string;

  @ApiPropertyOptional({ description: 'Number of messages to return', example: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile Client / Chat')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/chat')
export class MobileClientChatController {
  constructor(
    private readonly chatCompletion: ChatCompletionHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
  ) {}
  @ApiOperation({ summary: 'Send a message to the AI chatbot' })
  @ApiCreatedResponse({ description: 'AI response returned' })
  @Post()
  chat(
    @ClientSession() user: ClientSession,
    @Body() body: MobileChatBody,
  ) {
    return this.chatCompletion.execute({
      clientId: user.id,
      userMessage: body.userMessage,
      sessionId: body.sessionId,
    });
  }
  @ApiOperation({ summary: 'List conversations for the current client' })
  @ApiOkResponse({ description: 'Paginated conversation list' })
  @Get('conversations')
  listConversationsEndpoint(
    @ClientSession() user: ClientSession,
    @Query() q: MobileListConversationsQuery,
  ) {
    return this.listConversations.execute({
      clientId: user.id,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiOkResponse({ description: 'Cursor-paginated message list' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Get('conversations/:id/messages')
  listMessagesEndpoint(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: MobileListMessagesQuery,
  ) {
    return this.listMessages.execute({
      conversationId: id,
      clientId: user.id, // SECURITY (P0-4): restrict to caller's own conversation
      cursor: q.cursor,
      limit: q.limit ?? 30,
    });
  }
}
