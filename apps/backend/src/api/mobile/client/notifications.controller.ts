import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiOkResponse, ApiNoContentResponse, ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';
import { MarkReadDto } from '../../../modules/comms/notifications/mark-read.dto';
import { GetUnreadCountHandler } from '../../../modules/comms/notifications/get-unread-count.handler';
import { RegisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/unregister-fcm-token.handler';
import { RegisterFcmTokenDto } from '../../../modules/comms/fcm-tokens/register-fcm-token.dto';

export class MobileListNotificationsQuery {
  @ApiPropertyOptional({ description: 'Return only unread notifications', example: true })
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile Client / Notifications')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/notifications')
export class MobileClientNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
    private readonly getUnreadCount: GetUnreadCountHandler,
    private readonly registerFcm: RegisterFcmTokenHandler,
    private readonly unregisterFcm: UnregisterFcmTokenHandler,
  ) {}

  @ApiOperation({ summary: 'List notifications for the current client' })
  @ApiOkResponse({ description: 'Paginated notification list' })
  @Get()
  listNotificationsEndpoint(
    @ClientSession() user: ClientSession,
    @Query() q: MobileListNotificationsQuery,
  ) {
    return this.listNotifications.execute({
      recipientId: user.id,
      unreadOnly: q.unreadOnly,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Get unread notification count for the current client' })
  @ApiOkResponse({ description: 'Unread count value' })
  @Get('unread-count')
  getUnreadCountEndpoint(@ClientSession() user: ClientSession) {
    return this.getUnreadCount.execute({
      recipientId: user.id,
    });
  }

  @ApiOperation({
    summary: 'Mark notifications as read (all or a single one)',
    description: 'Pass `notificationId` in the body to mark a single notification; omit to mark all.',
  })
  @ApiNoContentResponse({ description: 'Notifications marked as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('mark-read')
  markReadEndpoint(
    @ClientSession() user: ClientSession,
    @Body() body: MarkReadDto = {},
  ) {
    return this.markRead.execute({
      recipientId: user.id,
      ...body,
    });
  }

  @ApiOperation({ summary: 'Register an FCM/APNs device token for the current client' })
  @ApiCreatedResponse({ description: 'Token stored' })
  @Post('fcm-token')
  @HttpCode(201)
  registerFcmEndpoint(
    @ClientSession() user: ClientSession,
    @Body() body: RegisterFcmTokenDto,
  ) {
    return this.registerFcm.execute({ clientId: user.id, ...body });
  }

  @ApiOperation({ summary: 'Remove all FCM tokens for the current client' })
  @ApiNoContentResponse({ description: 'Tokens removed' })
  @Delete('fcm-token')
  @HttpCode(204)
  async unregisterFcmEndpoint(@ClientSession() user: ClientSession) {
    await this.unregisterFcm.execute({ clientId: user.id });
  }
}
