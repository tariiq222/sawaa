import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class InitPackagePurchaseDto {
  @ApiProperty({
    description: 'SessionPackage UUID to purchase (must be a public, active package)',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsUUID()
  packageId!: string;

  @ApiProperty({
    description: 'Branch UUID the purchase is attributed to',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsUUID()
  branchId!: string;
}
