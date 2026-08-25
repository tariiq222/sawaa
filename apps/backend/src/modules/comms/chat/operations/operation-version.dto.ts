import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class OperationVersionDto {
  @ApiProperty({ description: 'Operation state version shown on the action card', minimum: 0 })
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
