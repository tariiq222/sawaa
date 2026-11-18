import { PaymentRecordDto } from '../../dashboard/dto/finance-payment-record-response.dto';

/**
 * Swagger response shapes for the authenticated CLIENT payment route under
 * `src/api/client/payments.controller.ts`:
 *
 *  - `POST /client/payments/bank-transfer` — the created `Payment` row, returned
 *    unmapped by `BankTransferUploadHandler` (status PENDING_VERIFICATION).
 *
 * The row is exactly the Prisma `Payment` model (`PaymentRecordDto` already
 * documents every column and carries a compile-time equality guard), so this
 * subclass only gives the client audience a prefixed schema name. Money
 * (`amount`, `refundedAmount`) stays a decimal string on the wire.
 *
 * Documentation only; no serializer is registered.
 */
export class ClientPaymentRecordDto extends PaymentRecordDto {}
