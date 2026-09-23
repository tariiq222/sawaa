import { Controller, Delete, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientResponseDto } from '../../dashboard/dto/people-response.dto';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { GetClientHandler } from '../../../modules/people/clients/get-client.handler';
import { UpdateClientProfileHandler } from '../../../modules/identity/client-auth/update-client-profile.handler';
import { Public } from '../../../common/guards/jwt.guard';
import { RequestAccountDeletionHandler } from '../../../modules/identity/request-account-deletion/request-account-deletion.handler';

export class MobileUpdateProfileBody {
  @ApiPropertyOptional({ description: 'Full display name', example: 'Sara Al-Harbi' })
  @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional({ description: 'Saudi mobile number', example: '+966501234567' })
  @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @IsString() email?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Preferred app locale', enum: ['ar', 'en'], example: 'ar' })
  @Type(() => Object)
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['ar', 'en'], { message: 'اللغة المفضلة غير صالحة' })
  preferredLocale?: 'ar' | 'en';

  @ApiPropertyOptional({ description: 'Whether push notifications are enabled', example: true })
  @Type(() => Object)
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean({ message: 'قيمة الإشعارات الفورية يجب أن تكون منطقية' })
  pushEnabled?: boolean;
}

@ApiTags('Mobile Client / Profile')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/profile')
export class MobileClientProfileController {
  constructor(
    private readonly getClient: GetClientHandler,
    private readonly updateClientProfile: UpdateClientProfileHandler,
    private readonly requestAccountDeletion: RequestAccountDeletionHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated client's profile" })
  @ApiOkResponse({ type: ClientResponseDto, description: 'Client profile record' })
  getProfile(@ClientSession() user: ClientSession) {
    return this.getClient.execute({ clientId: user.id });
  }

  @Patch()
  @ApiOperation({ summary: "Update the authenticated client's profile" })
  @ApiOkResponse({ type: ClientResponseDto, description: 'Updated client profile' })
  updateProfile(
    @ClientSession() user: ClientSession,
    @Body() body: MobileUpdateProfileBody,
  ) {
    return this.updateClientProfile.execute(user.id, body);
  }

  @Delete()
  @ApiOperation({ summary: "Close the authenticated client's login immediately" })
  @ApiOkResponse({
    description: 'Login closed; clinical and financial records retained',
    schema: {
      type: 'object', required: ['status', 'retained'],
      properties: {
        status: { type: 'string', enum: ['closed'] },
        retained: { type: 'array', items: { type: 'string', enum: ['clinical_records', 'financial_records'] } },
      },
    },
  })
  deleteProfile(@ClientSession() user: ClientSession) {
    return this.requestAccountDeletion.execute({ clientId: user.id });
  }
}
