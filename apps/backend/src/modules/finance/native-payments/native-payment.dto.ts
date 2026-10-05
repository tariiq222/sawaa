import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  NativePaymentCapabilities,
  NativePaymentConfiguration,
  NativePaymentReconcileResponse,
} from "@sawaa/shared/types";
export class NativeApplePayConfigDto {
  @ApiProperty() merchantId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ["SA"] }) countryCode!: "SA";
}
export class NativePaymentCapabilitiesDto implements NativePaymentCapabilities {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() isLive!: boolean;
  @ApiProperty({ isArray: true, enum: ["mada", "visa", "mastercard"] })
  supportedNetworks!: NativePaymentCapabilities["supportedNetworks"];
  @ApiProperty({ type: NativeApplePayConfigDto, nullable: true })
  applePay!: NativeApplePayConfigDto | null;
}
export class NativePaymentConfigurationDto
  extends NativePaymentCapabilitiesDto
  implements NativePaymentConfiguration
{
  @ApiProperty() publishableKey!: string;
  @ApiProperty({ format: "uuid" }) givenId!: string;
  @ApiProperty({ description: "Server-owned integer halalas" }) amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() description!: string;
}
export class NativePaymentInitResponseDto {
  @ApiProperty({ format: "uuid" }) paymentId!: string;
  @ApiProperty({ format: "uuid" }) invoiceId!: string;
  @ApiProperty({ type: NativePaymentConfigurationDto })
  config!: NativePaymentConfigurationDto;
}
export class NativePackagePurchaseInitResponseDto extends NativePaymentInitResponseDto {
  @ApiProperty({ format: "uuid" }) purchaseId!: string;
}
export class NativePaymentReconcileResponseDto implements NativePaymentReconcileResponse {
  @ApiProperty({ format: "uuid" }) paymentId!: string;
  @ApiProperty({ format: "uuid" }) invoiceId!: string;
  @ApiProperty({
    enum: ["PENDING", "COMPLETED", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"],
  })
  status!: NativePaymentReconcileResponse["status"];
  @ApiProperty() requiresReview!: boolean;
  @ApiPropertyOptional({
    description:
      "True only after provider404 for a current payable native reservation",
  })
  canCreatePayment?: boolean;
  @ApiPropertyOptional({
    enum: ["BOOKING_EXPIRED", "BOOKING_CLOSED", "INVOICE_CLOSED"],
    description: "Why a pending reservation cannot be resumed after provider404",
  })
  unavailableReason?: NativePaymentReconcileResponse["unavailableReason"];
}
