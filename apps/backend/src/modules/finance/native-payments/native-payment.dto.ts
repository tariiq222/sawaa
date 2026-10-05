import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  NativePaymentCapabilities,
  NativePaymentConfiguration,
  NativePaymentReconcileResponse,
} from "@sawaa/shared/types";
export class NativeApplePayConfigDto {
  @ApiProperty({
    description: "Apple Pay merchant identifier that must match the app entitlement",
    example: "merchant.sa.example.app",
  }) merchantId!: string;
  @ApiProperty({
    description: "Merchant display name shown on the Apple Pay payment sheet",
    example: "Example Counseling Center",
  }) label!: string;
  @ApiProperty({
    enum: ["SA"],
    description: "Merchant country code used for Apple Pay",
    example: "SA",
  }) countryCode!: "SA";
}
export class NativePaymentCapabilitiesDto implements NativePaymentCapabilities {
  @ApiProperty({
    description: "Whether online payments are enabled and a valid native publishable key is configured",
    example: true,
  }) enabled!: boolean;
  @ApiProperty({
    description: "Whether the configured Moyasar account uses live mode instead of test mode",
    example: false,
  }) isLive!: boolean;
  @ApiProperty({
    isArray: true,
    enum: ["mada", "visa", "mastercard"],
    description: "Card networks supported by native checkout",
    example: ["mada", "visa", "mastercard"],
  })
  supportedNetworks!: NativePaymentCapabilities["supportedNetworks"];
  @ApiProperty({
    type: NativeApplePayConfigDto,
    nullable: true,
    description: "Server Apple Pay configuration, or null when unavailable; device capability is checked separately",
    example: {
      merchantId: "merchant.sa.example.app",
      label: "Example Counseling Center",
      countryCode: "SA",
    },
  })
  applePay!: NativeApplePayConfigDto | null;
}
export class NativePaymentConfigurationDto
  extends NativePaymentCapabilitiesDto
  implements NativePaymentConfiguration
{
  @ApiProperty({
    description: "Public Moyasar SDK key matching the configured live or test mode",
    example: "pk_test_example000000000000000000000000",
  }) publishableKey!: string;
  @ApiProperty({
    format: "uuid",
    description: "Server-reserved payment UUID passed to Moyasar as the payment identity",
    example: "11111111-1111-4111-8111-111111111111",
  }) givenId!: string;
  @ApiProperty({
    description: "Server-owned payment amount in integer halalas",
    example: 5000,
  }) amount!: number;
  @ApiProperty({
    description: "Currency code from the invoice for the reserved payment",
    example: "SAR",
  }) currency!: string;
  @ApiProperty({
    description: "Server-generated payment description identifying the invoice",
    example: "Invoice payment - 22222222-2222-4222-8222-222222222222",
  }) description!: string;
}
export class NativePaymentInitResponseDto {
  @ApiProperty({
    format: "uuid",
    description: "Reserved internal payment UUID used for native reconciliation",
    example: "11111111-1111-4111-8111-111111111111",
  }) paymentId!: string;
  @ApiProperty({
    format: "uuid",
    description: "Owned invoice UUID associated with the reserved payment",
    example: "22222222-2222-4222-8222-222222222222",
  }) invoiceId!: string;
  @ApiProperty({
    type: NativePaymentConfigurationDto,
    description: "Server-owned SDK configuration for this reserved payment attempt",
    example: {
      enabled: true,
      isLive: false,
      supportedNetworks: ["mada", "visa", "mastercard"],
      applePay: null,
      publishableKey: "pk_test_example000000000000000000000000",
      givenId: "11111111-1111-4111-8111-111111111111",
      amount: 5000,
      currency: "SAR",
      description: "Invoice payment - 22222222-2222-4222-8222-222222222222",
    },
  })
  config!: NativePaymentConfigurationDto;
}
export class NativePackagePurchaseInitResponseDto extends NativePaymentInitResponseDto {
  @ApiProperty({
    format: "uuid",
    description: "Package purchase UUID associated with the invoice and native payment attempt",
    example: "33333333-3333-4333-8333-333333333333",
  }) purchaseId!: string;
}
export class NativePaymentReconcileResponseDto implements NativePaymentReconcileResponse {
  @ApiProperty({
    format: "uuid",
    description: "Owned internal payment UUID whose provider state was reconciled",
    example: "11111111-1111-4111-8111-111111111111",
  }) paymentId!: string;
  @ApiProperty({
    format: "uuid",
    description: "Invoice UUID associated with the reconciled payment",
    example: "22222222-2222-4222-8222-222222222222",
  }) invoiceId!: string;
  @ApiProperty({
    enum: ["PENDING", "COMPLETED", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"],
    description: "Internal payment status after checking the authoritative provider state",
    example: "PENDING",
  })
  status!: NativePaymentReconcileResponse["status"];
  @ApiProperty({
    description: "Whether the payment requires center review before the client proceeds or retries",
    example: false,
  }) requiresReview!: boolean;
  @ApiPropertyOptional({
    description:
      "True only after provider404 for a current payable native reservation",
    example: true,
  })
  canCreatePayment?: boolean;
  @ApiPropertyOptional({
    enum: ["BOOKING_EXPIRED", "BOOKING_CLOSED", "INVOICE_CLOSED"],
    description: "Why a pending reservation cannot be resumed after provider404",
    example: "BOOKING_EXPIRED",
  })
  unavailableReason?: NativePaymentReconcileResponse["unavailableReason"];
}
