import { ApiProperty } from "@nestjs/swagger";
import {
  MANUAL_RECEIPT_METHODS,
  ManualReceiptMethod,
} from "../../finance/record-previous-receipt/manual-receipt-method.helper";
export class GetLateSessionContextResponseDto {
  @ApiProperty({
    description:
      "Current VAT rate as a fraction, using the existing center policy",
    example: 0,
  })
  vatRate!: number;

  @ApiProperty({
    description: "Enabled methods permitted for manual receipt recording",
    enum: MANUAL_RECEIPT_METHODS,
    isArray: true,
    example: ["CASH", "BANK_TRANSFER"],
  })
  paymentMethods!: ManualReceiptMethod[];
}
