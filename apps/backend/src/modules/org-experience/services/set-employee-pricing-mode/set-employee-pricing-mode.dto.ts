import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetEmployeePricingModeDto {
  @ApiProperty({
    description:
      'When true, only practitioner-owned duration options are offered for this service. When false (default), the practitioner inherits service-level options.',
    example: false,
  })
  @IsBoolean()
  useCustomPricing!: boolean;
}

export type SetEmployeePricingModeCommand = SetEmployeePricingModeDto & {
  employeeId: string;
  serviceId: string;
};
