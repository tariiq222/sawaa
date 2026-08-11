import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { UserId } from '../../common/auth/user-id.decorator';
import { GetWhatsappAgentConfigHandler } from '../../modules/whatsapp-agent/agent-config/get-whatsapp-agent-config.handler';
import { UpsertWhatsappAgentConfigHandler } from '../../modules/whatsapp-agent/agent-config/upsert-whatsapp-agent-config.handler';
import { GetWhatsappStatusHandler } from '../../modules/whatsapp-agent/runtime/get-whatsapp-status.handler';
import { ControlWhatsappHandler } from '../../modules/whatsapp-agent/runtime/control-whatsapp.handler';
import { GetWhatsappQrHandler } from '../../modules/whatsapp-agent/runtime/get-whatsapp-qr.handler';
import { ListWhatsappConversationsHandler } from '../../modules/whatsapp-agent/conversations/list-whatsapp-conversations.handler';
import { GetWhatsappConversationHandler } from '../../modules/whatsapp-agent/conversations/get-whatsapp-conversation.handler';
import { StaffReplyHandler } from '../../modules/whatsapp-agent/conversations/staff-reply.handler';
import { CloseWhatsappConversationHandler } from '../../modules/whatsapp-agent/conversations/close-whatsapp-conversation.handler';
import { MarkWhatsappConversationReadHandler } from '../../modules/whatsapp-agent/conversations/mark-whatsapp-conversation-read.handler';
import { ReleaseWhatsappTakeoverHandler } from '../../modules/whatsapp-agent/conversations/release-whatsapp-takeover.handler';
import {
  UpsertWhatsappAgentConfigDto,
  WhatsappControlDto,
  StaffReplyDto,
} from '../../modules/integrations/whatsapp/dto/upsert-whatsapp-config.dto';

@ApiTags('Dashboard / WhatsApp Agent')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/whatsapp')
@UseGuards(JwtGuard, CaslGuard)
export class WhatsappAgentController {
  constructor(
    private readonly getAgentConfig: GetWhatsappAgentConfigHandler,
    private readonly upsertAgentConfig: UpsertWhatsappAgentConfigHandler,
    private readonly getStatus: GetWhatsappStatusHandler,
    private readonly control: ControlWhatsappHandler,
    private readonly getQr: GetWhatsappQrHandler,
    private readonly listConversations: ListWhatsappConversationsHandler,
    private readonly getConversation: GetWhatsappConversationHandler,
    private readonly staffReply: StaffReplyHandler,
    private readonly closeConversation: CloseWhatsappConversationHandler,
    private readonly markConversationRead: MarkWhatsappConversationReadHandler,
    private readonly releaseTakeover: ReleaseWhatsappTakeoverHandler,
  ) {}

  // ── AI Agent config ────────────────────────────────────────────────────────

  @Get('agent-config')
  @CheckPermissions({ action: 'read', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Get WhatsApp AI agent config (model, prompts, defaults)' })
  getAgentConfigEndpoint() {
    return this.getAgentConfig.execute();
  }

  @Patch('agent-config')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Update WhatsApp AI agent config' })
  upsertAgentConfigEndpoint(@Body() body: UpsertWhatsappAgentConfigDto) {
    return this.upsertAgentConfig.execute(body);
  }

  // ── Runtime control ────────────────────────────────────────────────────────

  @Get('status')
  @CheckPermissions({ action: 'read', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Get WhatsApp agent runtime status (connection, uptime, counters)' })
  getStatusEndpoint() {
    return this.getStatus.execute();
  }

  @Post('control')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Start, stop, or restart the WhatsApp agent' })
  controlEndpoint(@Body() body: WhatsappControlDto) {
    return this.control.execute(body);
  }

  @Get('qr')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get the current WhatsApp QR code for pairing (Baileys only)' })
  getQrEndpoint() {
    return this.getQr.execute();
  }

  // ── Conversations ───────────────────────────────────────────────────────────

  @Get('conversations')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List WhatsApp conversations (live monitoring)' })
  @ApiQuery({
    name: 'bookingFilter',
    required: false,
    enum: ['BOOKED', 'NOT_BOOKED'],
    description: 'Filter conversations by whether the AI created a WhatsApp booking for the client',
  })
  listConversationsEndpoint(
    @Query('status') status?: string,
    @Query('bookingFilter') bookingFilter?: string,
    @Query('search') search?: string,
    @Query('unread') unread?: string,
    @Query('staffTakeover') staffTakeover?: string,
    @Query('deliveryFailure') deliveryFailure?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('staffUserId') staffUserId?: string,
    @Query('sort') sort?: 'recent' | 'oldest',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const asBoolean = (value?: string) => value === undefined ? undefined : value === 'true' || value === '1';
    return this.listConversations.execute({
      status,
      bookingFilter: bookingFilter?.toUpperCase() === 'BOOKED'
        ? 'BOOKED'
        : bookingFilter?.toUpperCase() === 'NOT_BOOKED'
          ? 'NOT_BOOKED'
          : undefined,
      search,
      unread: asBoolean(unread),
      staffTakeover: asBoolean(staffTakeover),
      deliveryFailure: asBoolean(deliveryFailure),
      from,
      to,
      staffUserId,
      sort: sort === 'oldest' ? 'oldest' : 'recent',
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20)),
    });
  }

  @Get('conversations/:id')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get a WhatsApp conversation with all messages' })
  getConversationEndpoint(@Param('id') id: string) {
    return this.getConversation.execute(id);
  }

  @Post('conversations/:id/reply')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Send a message as staff (hand takeover)' })
  staffReplyEndpoint(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body() body: StaffReplyDto,
  ) {
    return this.staffReply.execute(id, userId, body);
  }

  @Post('conversations/:id/close')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Close a conversation and release staff takeover' })
  closeConversationEndpoint(@Param('id') id: string) {
    return this.closeConversation.execute(id);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'read', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Mark WhatsApp customer messages as read' })
  markConversationReadEndpoint(
    @Param('id') id: string,
    @Body() body: { throughMessageId?: string },
  ) {
    return this.markConversationRead.execute(id, body?.throughMessageId);
  }

  @Post('conversations/:id/release')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'WhatsappConversation' })
  @ApiOperation({ summary: 'Return a WhatsApp conversation to the AI agent' })
  releaseTakeoverEndpoint(@Param('id') id: string) {
    return this.releaseTakeover.execute(id);
  }
}
