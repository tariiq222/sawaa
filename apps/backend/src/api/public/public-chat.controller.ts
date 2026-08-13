import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { toChatConversationResponse } from '../../modules/comms/chat/guest/chat-conversation.response';
import { CreateGuestConversationDto } from '../../modules/comms/chat/guest/create-guest-conversation.dto';
import { CreateGuestConversationHandler } from '../../modules/comms/chat/guest/create-conversation.handler';
import { CHAT_GUEST_COOKIE_NAME, GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';

type CookieRequest = Request & { cookies?: Record<string, unknown> };

@ApiTags('Public / Chat')
@ApiPublicResponses()
@Controller('public/chat')
export class PublicChatController {
  constructor(
    private readonly createConversation: CreateGuestConversationHandler,
    private readonly getCurrentConversation: GetCurrentConversationHandler,
    private readonly tokens: GuestChatTokenService,
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
}
