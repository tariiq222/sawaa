import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// SECURITY (P0-8): `clientId` is no longer accepted from the request body.
// The handler now derives the redeeming client from `invoice.clientId`, and
// any client-surface caller must additionally match that id via the new
// callerClientId parameter set by the controller from the JWT.
export class ApplyCouponDto {
  @ApiProperty({ description: 'Invoice to apply the coupon to', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;

  @ApiProperty({ description: 'Coupon code to apply', example: 'WELCOME10' })
  @IsString() @MinLength(3) @MaxLength(64) code!: string;
}
