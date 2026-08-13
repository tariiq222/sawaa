import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
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
import { toChatMessageResponse } from '../../modules/comms/chat/messages/chat-message.mapper';
import { ListChatMessagesDto } from '../../modules/comms/chat/messages/list-chat-messages.dto';
import { ListChatMessagesHandler } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import { SendChatMessageDto } from '../../modules/comms/chat/messages/send-chat-message.dto';
import { SendChatMessageHandler } from '../../modules/comms/chat/messages/send-chat-message.handler';
import { RequestHandoffHandler } from '../../modules/comms/chat/staff/request-handoff.handler';
import { ClientRequestHandoffDto } from '../../modules/comms/chat/staff/request-handoff.dto';
import { toChatConversationResponse } from '../../modules/comms/chat/guest/chat-conversation.response';
import { AcknowledgeExistingBookingHandler } from '../../modules/comms/chat/operations/acknowledge-existing-booking.handler';
import { ConfirmOperationHandler } from '../../modules/comms/chat/operations/confirm-operation.handler';
import { DeclineOperationHandler } from '../../modules/comms/chat/operations/decline-operation.handler';
import { OperationVersionDto } from '../../modules/comms/chat/operations/operation-version.dto';
import { toPublicChatOperation } from '../../modules/comms/chat/operations/chat-operation-public.mapper';

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
    private readonly sendMessage: SendChatMessageHandler,
    private readonly listMessages: ListChatMessagesHandler,
    private readonly requestHandoff: RequestHandoffHandler,
    private readonly acknowledgeOperation: AcknowledgeExistingBookingHandler,
    private readonly confirmOperation: ConfirmOperationHandler,
    private readonly declineOperation: DeclineOperationHandler,
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

  @Post('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message as the authenticated client' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Client conversation UUID' })
  async sendMessageForClient(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendChatMessageDto,
    @ClientSession() session: { id: string },
  ) {
    return toChatMessageResponse(await this.sendMessage.execute({
      audience: 'client',
      conversationId,
      clientId: session.id,
      ...dto,
    }));
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List messages as the authenticated client' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Client conversation UUID' })
  listMessagesForClient(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() dto: ListChatMessagesDto,
    @ClientSession() session: { id: string },
  ) {
    return this.listMessages.execute({
      audience: 'client',
      conversationId,
      clientId: session.id,
      limit: dto.limit ?? 20,
      ...(dto.cursor ? { cursor: dto.cursor } : {}),
    });
  }

  @Post('conversations/:conversationId/handoff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request reception handoff as the authenticated client' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Client conversation UUID' })
  async requestReceptionForClient(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() _dto: ClientRequestHandoffDto,
    @ClientSession() session: { id: string },
  ) {
    return toChatConversationResponse(await this.requestHandoff.execute({
      audience: 'client',
      conversationId,
      clientId: session.id,
    }));
  }

  @Post('operations/:operationId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an additional appointment before confirmation' })
  @ApiParam({ name: 'operationId', format: 'uuid', description: 'Chat operation UUID' })
  async acknowledgeAdditionalBooking(
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Body() dto: OperationVersionDto,
    @ClientSession() session: { id: string },
  ) {
    return toPublicChatOperation(await this.acknowledgeOperation.execute({
      operationId,
      clientId: session.id,
      expectedVersion: dto.expectedVersion,
    }));
  }

  @Post('operations/:operationId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm and execute a prepared chat operation' })
  @ApiParam({ name: 'operationId', format: 'uuid', description: 'Chat operation UUID' })
  async confirmPreparedOperation(
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Body() dto: OperationVersionDto,
    @ClientSession() session: { id: string },
  ) {
    return toPublicChatOperation(await this.confirmOperation.execute({
      operationId,
      clientId: session.id,
      expectedVersion: dto.expectedVersion,
    }));
  }

  @Post('operations/:operationId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a prepared chat operation without executing it' })
  @ApiParam({ name: 'operationId', format: 'uuid', description: 'Chat operation UUID' })
  async declinePreparedOperation(
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Body() dto: OperationVersionDto,
    @ClientSession() session: { id: string },
  ) {
    return toPublicChatOperation(await this.declineOperation.execute({
      operationId,
      clientId: session.id,
      expectedVersion: dto.expectedVersion,
    }));
  }
}
