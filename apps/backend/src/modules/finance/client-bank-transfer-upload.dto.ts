import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

/** Multipart text fields that accompany the receipt file of a client bank-transfer upload. */
export class ClientBankTransferUploadDto {
  @ApiProperty({ description: 'Invoice being paid', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;

  @ApiProperty({ description: 'Transfer amount in integer halalas', example: 10000 })
  @IsInt() @Min(1) @Type(() => Number) amount!: number;
}
