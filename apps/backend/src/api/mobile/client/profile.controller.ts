import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
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

export class MobileUpdateProfileBody {
  @ApiPropertyOptional({ description: 'Full display name', example: 'Sara Al-Harbi' })
  @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional({ description: 'Saudi mobile number', example: '+966501234567' })
  @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional() @IsString() email?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/sara.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string;
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
}
