import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtUser } from '../../common/auth/current-user.decorator';
import { UserId } from '../../common/auth/user-id.decorator';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { SendChatMessageDto } from '../../modules/comms/chat/messages/send-chat-message.dto';
import { toChatMessageResponse } from '../../modules/comms/chat/messages/chat-message.mapper';
import { AssignConversationDto } from '../../modules/comms/chat/staff/assign-conversation.dto';
import { AssignConversationHandler } from '../../modules/comms/chat/staff/assign-conversation.handler';
import { ClaimConversationHandler } from '../../modules/comms/chat/staff/claim-conversation.handler';
import { CloseConversationHandler } from '../../modules/comms/chat/staff/close-conversation.handler';
import { GetConversationHandler } from '../../modules/comms/chat/staff/get-conversation.handler';
import { ListConversationMessagesHandler } from '../../modules/comms/chat/staff/list-conversation-messages.handler';
import { ListInboxDto } from '../../modules/comms/chat/staff/list-inbox.dto';
import { ListInboxHandler } from '../../modules/comms/chat/staff/list-inbox.handler';
import { MarkConversationReadDto } from '../../modules/comms/chat/staff/mark-conversation-read.dto';
import { MarkConversationReadHandler } from '../../modules/comms/chat/staff/mark-conversation-read.handler';
import { ReleaseConversationHandler } from '../../modules/comms/chat/staff/release-conversation.handler';
import { ReplyConversationHandler } from '../../modules/comms/chat/staff/reply-conversation.handler';
import { toStaffConversationResponse } from '../../modules/comms/chat/staff/staff-conversation.mapper';
import { ListChatMessagesDto } from '../../modules/comms/chat/messages/list-chat-messages.dto';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/conversations')
export class DashboardConversationsController {
  constructor(
    private readonly listInbox: ListInboxHandler,
    private readonly getConversation: GetConversationHandler,
    private readonly listMessages: ListConversationMessagesHandler,
    private readonly claimConversation: ClaimConversationHandler,
    private readonly markRead: MarkConversationReadHandler,
    private readonly replyConversation: ReplyConversationHandler,
    private readonly assignConversation: AssignConversationHandler,
    private readonly releaseConversation: ReleaseConversationHandler,
    private readonly closeConversation: CloseConversationHandler,
  ) {}

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Conversation' })
  @ApiOperation({ summary: 'List reception chat inbox conversations' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'assigned', required: false, enum: ['all', 'me', 'unassigned'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@Query() dto: ListInboxDto, @UserId() staffUserId: string, @CurrentUser() user: JwtUser) {
    return this.listInbox.execute({
      staffUserId,
      staffRole: user.role,
      limit: dto.limit ?? 20,
      ...(dto.cursor ? { cursor: dto.cursor } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.unreadOnly === undefined ? {} : { unreadOnly: dto.unreadOnly }),
      ...(dto.assigned ? { assigned: dto.assigned } : {}),
      ...(dto.search ? { search: dto.search } : {}),
      ...(dto.from ? { from: dto.from } : {}),
      ...(dto.to ? { to: dto.to } : {}),
    });
  }

  @Get(':conversationId')
  @CheckPermissions({ action: 'read', subject: 'Conversation' })
  @ApiOperation({ summary: 'Get a reception chat conversation' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  get(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @UserId() staffUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.getConversation.execute({ conversationId, staffUserId, staffRole: user.role });
  }

  @Get(':conversationId/messages')
  @CheckPermissions({ action: 'read', subject: 'Conversation' })
  @ApiOperation({ summary: 'List reception chat conversation messages' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  messages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() dto: ListChatMessagesDto,
    @UserId() staffUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.listMessages.execute({
      conversationId,
      staffUserId,
      staffRole: user.role,
      limit: dto.limit ?? 20,
      ...(dto.cursor ? { cursor: dto.cursor } : {}),
    });
  }

  @Post(':conversationId/claim')
  @CheckPermissions({ action: 'update', subject: 'Conversation' })
  @ApiOperation({ summary: 'Claim a waiting reception conversation' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  async claim(@Param('conversationId', ParseUUIDPipe) conversationId: string, @UserId() staffUserId: string) {
    return toStaffConversationResponse(await this.claimConversation.execute({ conversationId, staffUserId }));
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'update', subject: 'Conversation' })
  @ApiOperation({ summary: 'Mark owned visitor and client messages as read' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  read(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: MarkConversationReadDto,
    @UserId() staffUserId: string,
  ) {
    return this.markRead.execute({
      conversationId,
      staffUserId,
      ...(dto.throughMessageId ? { throughMessageId: dto.throughMessageId } : {}),
      ...(dto.throughSequence ? { throughSequence: dto.throughSequence } : {}),
    });
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions({ action: 'update', subject: 'Conversation' })
  @ApiOperation({ summary: 'Reply to an assigned reception conversation' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  async reply(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendChatMessageDto,
    @UserId() staffUserId: string,
  ) {
    return toChatMessageResponse(await this.replyConversation.execute({ conversationId, staffUserId, ...dto }));
  }

  @Post(':conversationId/assign')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Conversation' })
  @ApiOperation({ summary: 'Assign a reception conversation to a dashboard user' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  async assign(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: AssignConversationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return toStaffConversationResponse(await this.assignConversation.execute({
      conversationId, targetStaffUserId: dto.targetStaffUserId, actorRole: user.role,
    }));
  }

  @Post(':conversationId/release')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'update', subject: 'Conversation' })
  @ApiOperation({ summary: 'Release a staff conversation back to the assistant' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  async release(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @UserId() actorUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return toStaffConversationResponse(await this.releaseConversation.execute({ conversationId, actorUserId, actorRole: user.role }));
  }

  @Post(':conversationId/close')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'update', subject: 'Conversation' })
  @ApiOperation({ summary: 'Close a reception conversation' })
  @ApiParam({ name: 'conversationId', format: 'uuid', description: 'Conversation UUID' })
  async close(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @UserId() actorUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return toStaffConversationResponse(await this.closeConversation.execute({ conversationId, actorUserId, actorRole: user.role }));
  }
}
