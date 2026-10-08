import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class RequestEmployeeContactDto {
  @ApiProperty({ description: 'New contact channel', enum: ['EMAIL', 'SMS'], example: 'EMAIL' })
  @IsIn(['EMAIL', 'SMS']) channel!: 'EMAIL' | 'SMS';
  @ApiProperty({ description: 'New email address or phone number', example: 'new@example.com' })
  @IsString() @MinLength(1) @MaxLength(254) identifier!: string;
}
export class VerifyEmployeeContactDto {
  @ApiProperty({ description: 'Challenge returned by the request endpoint', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  @IsUUID() challengeId!: string;
  @ApiProperty({ description: 'Six-digit confirmation code', example: '123456' })
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
export class EmployeeContactChallengeResponseDto {
  @ApiProperty({ format: 'uuid', example: '00000000-0000-4000-a000-000000000001' }) challengeId!: string;
  @ApiProperty({ example: 300 }) expiresIn!: number;
  @ApiProperty({ example: 60 }) retryAfterSeconds!: number;
}
