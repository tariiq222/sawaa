import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferCreditDto {
  @ApiProperty({
    description: 'Target employee (practitioner) to move the credit to',
    example: '00000000-0000-4000-a000-000000000099',
  })
  @IsUUID()
  toEmployeeId!: string;
}
