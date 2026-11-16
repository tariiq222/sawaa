import { ApiProperty } from '@nestjs/swagger';

/** One purchasable duration/delivery option of a practitioner on a service. */
export class PublicPractitionerBookingOptionDto {
  @ApiProperty({ enum: ['IN_PERSON', 'ONLINE'], description: 'Delivery channel of this option', example: 'IN_PERSON' })
  deliveryType!: 'IN_PERSON' | 'ONLINE';

  @ApiProperty({
    description: 'Duration-option UUID; empty string when the option is priced from the service booking config fallback',
    example: '00000000-0000-4000-a000-000000000003',
  })
  durationOptionId!: string;

  @ApiProperty({ type: 'integer', description: 'Session duration in minutes', example: 45 })
  durationMins!: number;

  @ApiProperty({ description: 'Price in integer halalas', example: 30000 })
  price!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Option label, or null', example: '45 دقيقة' })
  label!: string | null;
}

/** `GET /public/services/:serviceId/practitioners/:employeeId/booking-options`. */
export class PublicPractitionerBookingOptionsDto {
  @ApiProperty({ description: 'Whether this practitioner uses their own duration rows instead of the service defaults', example: false })
  useCustomPricing!: boolean;

  @ApiProperty({ type: [String], enum: ['IN_PERSON', 'ONLINE'], description: 'Delivery channels this practitioner does not offer', example: [] })
  disabledDeliveryTypes!: ('IN_PERSON' | 'ONLINE')[];

  @ApiProperty({ type: [PublicPractitionerBookingOptionDto], description: 'Bookable options; empty when the practitioner is inactive' })
  options!: PublicPractitionerBookingOptionDto[];
}
