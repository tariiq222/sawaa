import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ClientGender, ClientSource } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientResponseDto } from '../../dashboard/dto/people-response.dto';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { GetClientHandler } from '../../../modules/people/clients/get-client.handler';
import { UpdateClientHandler } from '../../../modules/people/clients/update-client.handler';

export class MobileUpdateProfileBody {
  @ApiPropertyOptional({ description: 'Full display name', example: 'Sara Al-Harbi' })
  @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional({ description: 'Saudi mobile number', example: '+966501234567', nullable: true })
  @IsOptional() @IsString() phone?: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com', nullable: true })
  @IsOptional() @IsString() email?: string | null;

  @ApiPropertyOptional({ description: 'Gender', enum: ClientGender, enumName: 'ClientGender', example: ClientGender.FEMALE })
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601)', example: '1990-06-15', nullable: true })
  @IsOptional() @IsString() dateOfBirth?: string | null;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string | null;

  @ApiPropertyOptional({ description: 'Personal notes', example: 'Prefers morning appointments', nullable: true })
  @IsOptional() @IsString() notes?: string | null;

  @ApiPropertyOptional({ description: 'Acquisition source', enum: ClientSource, enumName: 'ClientSource', example: ClientSource.ONLINE })
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;

  @ApiPropertyOptional({ description: 'Whether the account is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Preferred locale (ISO 639-1)', example: 'ar', nullable: true })
  @IsOptional() @IsString() preferredLocale?: string | null;

  @ApiPropertyOptional({ description: 'Push notifications enabled', example: true })
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
}

@ApiTags('Mobile Client / Profile')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/profile')
export class MobileClientProfileController {
  constructor(
    private readonly getClient: GetClientHandler,
    private readonly updateClient: UpdateClientHandler,
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
    return this.updateClient.execute({ clientId: user.id, ...body });
  }
}
