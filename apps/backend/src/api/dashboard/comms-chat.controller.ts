import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListConversationsDto } from '../../modules/comms/chat/list-conversations.dto';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';
import { ListMessagesDto } from '../../modules/comms/chat/list-messages.dto';
import { GetConversationHandler } from '../../modules/comms/chat/get-conversation.handler';
import { CloseConversationHandler } from '../../modules/comms/chat/close-conversation.handler';
import { SendStaffMessageHandler } from '../../modules/comms/chat/send-staff-message.handler';
import { SendStaffMessageDto } from '../../modules/comms/chat/send-staff-message.dto';
import { ListTenantDeliveryLogsHandler } from '../../modules/comms/list-tenant-delivery-logs/list-tenant-delivery-logs.handler';
import { ListTenantDeliveryLogsDto } from '../../modules/comms/list-tenant-delivery-logs/list-tenant-delivery-logs.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardCommsController')
export class DashboardCommsChatController {
  constructor(
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
    private readonly getConversation: GetConversationHandler,
    private readonly closeConversation: CloseConversationHandler,
    private readonly sendStaffMessage: SendStaffMessageHandler,
    private readonly listTenantDeliveryLogs: ListTenantDeliveryLogsHandler,
  ) {}

  @ApiOperation({ summary: 'List chat conversations' })
  @ApiOkResponse({ description: 'Paginated conversation list' })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Get('chat/conversations')
  listConversationsEndpoint(
    @Query() query: ListConversationsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.listConversations.execute({
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
      clientId: query.clientId,
      employeeId: query.employeeId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiOkResponse({ description: 'Cursor-paginated message list' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Get('chat/conversations/:id/messages')
  listMessagesEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.listMessages.execute({
      conversationId: id,
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Get a single conversation by ID' })
  @ApiOkResponse({ description: 'Conversation details' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Get('chat/conversations/:id')
  getConversationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    // AUTHZ-004: scope EMPLOYEE callers to their assigned conversations.
    return this.getConversation.execute({
      conversationId: id,
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
    });
  }

  @ApiOperation({ summary: 'Close a conversation' })
  @ApiOkResponse({ description: 'Conversation closed' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @Patch('chat/conversations/:id/close')
  @HttpCode(HttpStatus.OK)
  closeConversationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    // AUTHZ-004: scope EMPLOYEE callers to their assigned conversations.
    return this.closeConversation.execute({
      conversationId: id,
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
    });
  }

  @ApiOperation({ summary: 'Send a staff message in a conversation' })
  @ApiCreatedResponse({ description: 'Message sent' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @Post('chat/conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendStaffMessageEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStaffMessageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sendStaffMessage.execute({
      conversationId: id,
      staffId: user.sub,
      body: body.body,
      // AUTHZ-004: scope EMPLOYEE callers to their assigned conversations.
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
    });
  }

  @CheckPermissions({ action: 'read', subject: 'PersonalData' })
  @Get('delivery-logs')
  @ApiOperation({ summary: 'List email delivery logs for this organization' })
  @ApiOkResponse({ description: 'Paginated delivery log' })
  async listDeliveryLogs(
    @Query() dto: ListTenantDeliveryLogsDto,
  ): Promise<unknown> {
    return this.listTenantDeliveryLogs.execute(dto);
  }
}
