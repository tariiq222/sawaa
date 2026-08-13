import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { toChatConversationResponse } from '../../modules/comms/chat/guest/chat-conversation.response';
import { CreateGuestConversationDto } from '../../modules/comms/chat/guest/create-guest-conversation.dto';
import { CreateGuestConversationHandler } from '../../modules/comms/chat/guest/create-conversation.handler';
import { CHAT_GUEST_COOKIE_NAME, GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { ListMessagesDto } from '../../modules/comms/chat/list-messages.dto';
import { toChatMessageResponse } from '../../modules/comms/chat/messages/chat-message.mapper';
import { ListChatMessagesHandler } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import { SendChatMessageDto } from '../../modules/comms/chat/messages/send-chat-message.dto';
import { SendChatMessageHandler } from '../../modules/comms/chat/messages/send-chat-message.handler';

type CookieRequest = Request & { cookies?: Record<string, unknown> };

@ApiTags('Public / Chat')
@ApiPublicResponses()
@Controller('public/chat')
export class PublicChatController {
  constructor(
    private readonly createConversation: CreateGuestConversationHandler,
    private readonly getCurrentConversation: GetCurrentConversationHandler,
    private readonly tokens: GuestChatTokenService,
    private readonly sendMessage: SendChatMessageHandler,
    private readonly listMessages: ListChatMessagesHandler,
  ) {}

  @Public()
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a guest chat conversation' })
  @ApiCreatedResponse({ description: 'Guest conversation created; access token is delivered only as an HttpOnly cookie' })
  async create(
    @Body() dto: CreateGuestConversationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { conversation, guestToken } = await this.createConversation.execute(dto);
    response.cookie(CHAT_GUEST_COOKIE_NAME, guestToken, this.tokens.setCookieOptions());
    return toChatConversationResponse(conversation);
  }

  @Public()
  @Get('conversations/current')
  @ApiOperation({ summary: 'Get the current guest chat conversation' })
  @ApiOkResponse({ description: 'Current conversation for the supplied guest cookie' })
  current(@Req() request: CookieRequest) {
    const guestToken = request.cookies?.[CHAT_GUEST_COOKIE_NAME];
    if (typeof guestToken !== 'string' || guestToken.length === 0) {
      throw new UnauthorizedException('Guest chat cookie is required');
    }
    return this.getCurrentConversation.execute({ guestToken });
  }

  @Public()
  @Post('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message as a guest chat owner' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Guest conversation UUID' })
  async sendMessageForGuest(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendChatMessageDto,
    @Req() request: CookieRequest,
  ) {
    const guestToken = this.requireGuestToken(request);
    return toChatMessageResponse(await this.sendMessage.execute({
      audience: 'guest',
      conversationId,
      guestToken,
      ...dto,
    }));
  }

  @Public()
  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List messages as a guest chat owner' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Guest conversation UUID' })
  listMessagesForGuest(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() dto: ListMessagesDto,
    @Req() request: CookieRequest,
  ) {
    const guestToken = this.requireGuestToken(request);
    return this.listMessages.execute({
      audience: 'guest',
      conversationId,
      guestToken,
      limit: dto.limit ?? 20,
      ...(dto.cursor ? { cursor: dto.cursor } : {}),
    });
  }

  private requireGuestToken(request: CookieRequest): string {
    const guestToken = request.cookies?.[CHAT_GUEST_COOKIE_NAME];
    if (typeof guestToken !== 'string' || guestToken.length === 0) {
      throw new UnauthorizedException('Guest chat cookie is required');
    }
    return guestToken;
  }
}
