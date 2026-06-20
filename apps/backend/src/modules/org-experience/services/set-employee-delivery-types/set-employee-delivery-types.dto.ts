import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryType } from '@prisma/client';

export class SetEmployeeDeliveryTypesDto {
  @ApiProperty({
    description:
      'Delivery types this practitioner does NOT offer for the service. ' +
      'Empty array means they offer every type the service supports.',
    example: ['ONLINE'],
    isArray: true,
    enum: DeliveryType,
  })
  @IsArray()
  @IsEnum(DeliveryType, { each: true })
  disabledDeliveryTypes!: string[];
}

export type SetEmployeeDeliveryTypesCommand = SetEmployeeDeliveryTypesDto & {
  employeeId: string;
  serviceId: string;
};
