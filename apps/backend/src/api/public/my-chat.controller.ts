import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { Public } from '../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { ClaimConversationHandler } from '../../modules/comms/chat/guest/claim-conversation.handler';
import { ClaimGuestConversationDto } from '../../modules/comms/chat/guest/claim-guest-conversation.dto';
import { CHAT_GUEST_COOKIE_NAME, GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';

type CookieRequest = Request & { cookies?: Record<string, unknown> };

@ApiTags('Public / Chat')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('public/me/chat')
export class MyChatController {
  constructor(
    private readonly getCurrentConversation: GetCurrentConversationHandler,
    private readonly claimConversation: ClaimConversationHandler,
    private readonly tokens: GuestChatTokenService,
  ) {}

  @Get('conversations/current')
  @ApiOperation({ summary: 'Get the authenticated client chat conversation' })
  @ApiOkResponse({ description: 'Current conversation for the authenticated client' })
  current(@ClientSession() session: { id: string }) {
    return this.getCurrentConversation.execute({ clientId: session.id });
  }

  @Post('conversations/:conversationId/claim')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Claim a guest conversation for the authenticated client' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Guest conversation UUID' })
  @ApiCreatedResponse({ description: 'Guest conversation claimed by the authenticated client' })
  async claim(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() _body: ClaimGuestConversationDto,
    @ClientSession() session: { id: string },
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const guestToken = request.cookies?.[CHAT_GUEST_COOKIE_NAME];
    if (typeof guestToken !== 'string' || guestToken.length === 0) {
      throw new UnauthorizedException('Guest chat cookie is required');
    }
    const conversation = await this.claimConversation.execute({
      conversationId,
      clientId: session.id,
      guestToken,
    });
    response.clearCookie(CHAT_GUEST_COOKIE_NAME, this.tokens.clearCookieOptions());
    return conversation;
  }
}
