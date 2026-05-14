import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestDashboardOtpDto {
  @ApiProperty({
    description: 'Email address or Saudi mobile number (E.164 format)',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  identifier!: string;
}