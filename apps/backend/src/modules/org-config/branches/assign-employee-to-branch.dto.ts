import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignEmployeeToBranchDto {
  @ApiProperty({ description: 'UUID of the employee to assign', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;
}
