import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiErrorDto, ApiStandardResponses } from '../../common/swagger';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { ListNotificationsDto } from '../../modules/comms/notifications/list-notifications.dto';
import { GetUnreadCountHandler } from '../../modules/comms/notifications/get-unread-count.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { MarkReadDto } from '../../modules/comms/notifications/mark-read.dto';
import { ListContactMessagesHandler } from '../../modules/comms/contact-messages/list-contact-messages.handler';
import { ListContactMessagesDto } from '../../modules/comms/contact-messages/list-contact-messages.dto';
import { UpdateContactMessageStatusHandler } from '../../modules/comms/contact-messages/update-contact-message-status.handler';
import { UpdateContactMessageStatusDto } from '../../modules/comms/contact-messages/update-contact-message-status.dto';
import {
  ContactMessageResponseDto,
  PaginatedContactMessagesResponseDto,
} from './dto/contact-message-response.dto';
import {
  PaginatedNotificationsResponseDto,
  UnreadNotificationCountResponseDto,
} from './dto/notification-response.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardCommsController')
export class DashboardCommsInboxController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly getUnreadCount: GetUnreadCountHandler,
    private readonly markRead: MarkReadHandler,
    private readonly listContactMessages: ListContactMessagesHandler,
    private readonly updateContactMessageStatus: UpdateContactMessageStatusHandler,
  ) {}

  @ApiOperation({ summary: 'List contact messages' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page', example: 20 })
  @ApiOkResponse({ description: 'Paginated contact messages', type: PaginatedContactMessagesResponseDto })
  @CheckPermissions({ action: 'read', subject: 'PersonalData' })
  @Get('contact-messages')
  listContactMessagesEndpoint(@Query() query: ListContactMessagesDto) {
    return this.listContactMessages.execute({
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Update contact message status' })
  @ApiParam({ name: 'id', description: 'Contact message UUID' })
  @ApiOkResponse({ description: 'Updated message', type: ContactMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Contact message not found', type: ApiErrorDto })
  @CheckPermissions({ action: 'update', subject: 'PersonalData' })
  @Patch('contact-messages/:id/status')
  updateContactMessageStatusEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactMessageStatusDto,
  ) {
    return this.updateContactMessageStatus.execute({ id, status: dto.status });
  }

  @ApiOperation({ summary: 'List notifications for the current staff user' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based, default: 1)',
    schema: { type: 'integer', minimum: 1, default: 1 },
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (1–200, default: 20)',
    schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
    example: 20,
  })
  @ApiOkResponse({ description: 'Paginated notification list', type: PaginatedNotificationsResponseDto })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Get('notifications')
  listNotificationsEndpoint(
    @CurrentUser() user: JwtUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.listNotifications.execute({
      recipientId: user.sub,
      unreadOnly: query.unreadOnly,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Get unread notification count for the current staff user' })
  @ApiOkResponse({ description: 'Unread count value', type: UnreadNotificationCountResponseDto })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Get('notifications/unread-count')
  getUnreadCountEndpoint(
    @CurrentUser() user: JwtUser,
  ) {
    return this.getUnreadCount.execute({
      recipientId: user.sub,
    });
  }

  @ApiOperation({ summary: 'Mark notifications as read (all or a single one)' })
  @ApiNoContentResponse({ description: 'Notifications marked as read' })
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @Patch('notifications/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markReadEndpoint(
    @CurrentUser() user: JwtUser,
    @Body() body: MarkReadDto = {},
  ) {
    return this.markRead.execute({
      recipientId: user.sub,
      ...body,
    });
  }
}
