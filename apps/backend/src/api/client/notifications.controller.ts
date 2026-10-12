import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { CLIENT_PAGE_SCHEMA, toClientPage } from './client-page';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { toBoolean } from '../../modules/comms/notifications/list-notifications.dto';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { MarkReadDto } from '../../modules/comms/notifications/mark-read.dto';
import { GetUnreadCountHandler } from '../../modules/comms/notifications/get-unread-count.handler';
import { RegisterFcmTokenHandler } from '../../modules/comms/fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from '../../modules/comms/fcm-tokens/unregister-fcm-token.handler';
import { RegisterFcmTokenDto } from '../../modules/comms/fcm-tokens/register-fcm-token.dto';

export class ListClientNotificationsQuery {
  @ApiPropertyOptional({ description: 'Return only unread notifications', example: true })
  @IsOptional() @Transform(toBoolean) @IsBoolean() unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class UnregisterClientFcmQuery {
  @ApiPropertyOptional({ description: 'FCM registration token for this device; omit to remove all devices' })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(512)
  token?: string;
}

@ApiTags('Client / Notifications')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/notifications')
export class ClientNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
    private readonly getUnreadCount: GetUnreadCountHandler,
    private readonly registerFcm: RegisterFcmTokenHandler,
    private readonly unregisterFcm: UnregisterFcmTokenHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current client' })
  @ApiOkResponse({ description: 'Paginated notification list', schema: CLIENT_PAGE_SCHEMA })
  async list(@ClientSession() session: ClientSession, @Query() q: ListClientNotificationsQuery) {
    const result = await this.listNotifications.execute({
      recipientId: session.id,
      unreadOnly: q.unreadOnly,
      page: q.page ?? 1,
      limit: q.pageSize ?? 20,
    });
    return toClientPage(result.items, result.meta.total, result.meta.page, result.meta.limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current client' })
  @ApiOkResponse({ description: 'Unread count value' })
  unreadCount(@ClientSession() session: ClientSession) {
    return this.getUnreadCount.execute({ recipientId: session.id });
  }

  @ClientThrottle('write')
  @Patch('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark notifications as read (all or a single one)',
    description: 'Pass `notificationId` in the body to mark a single notification; omit to mark all.',
  })
  @ApiNoContentResponse({ description: 'Notifications marked as read' })
  markReadEndpoint(@ClientSession() session: ClientSession, @Body() body: MarkReadDto = {}) {
    return this.markRead.execute({ recipientId: session.id, ...body });
  }

  @ClientThrottle('write')
  @Post('fcm-token')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register an FCM registration token for the current client' })
  @ApiCreatedResponse({ description: 'Token stored' })
  registerFcmToken(@ClientSession() session: ClientSession, @Body() body: RegisterFcmTokenDto) {
    return this.registerFcm.execute({ clientId: session.id, ...body });
  }

  @ClientThrottle('write')
  @Delete('fcm-token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a device token, or all tokens when omitted' })
  @ApiNoContentResponse({ description: 'Tokens removed' })
  async unregisterFcmToken(@ClientSession() session: ClientSession, @Query() query: UnregisterClientFcmQuery) {
    await this.unregisterFcm.execute({ clientId: session.id, ...(query.token ? { token: query.token } : {}) });
  }
}
