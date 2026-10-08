import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RlsTransactionService } from "../../../infrastructure/database";
import { resolveVatRate } from "../../finance/create-invoice/create-invoice.handler";
import { getEnabledManualReceiptMethods } from "../../finance/record-previous-receipt/manual-receipt-method.helper";
import { GetLateSessionContextResponseDto } from "./get-late-session-context.dto";
@Injectable()
export class GetLateSessionContextHandler {
  constructor(private readonly transactions: RlsTransactionService) {}
  async execute(): Promise<GetLateSessionContextResponseDto> {
    return this.transactions.withTransaction(
      async (tx) => {
        const [vatRate, paymentMethods] = await Promise.all([
          resolveVatRate(tx),
          getEnabledManualReceiptMethods(tx),
        ]);
        return { vatRate: Number(vatRate), paymentMethods };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
