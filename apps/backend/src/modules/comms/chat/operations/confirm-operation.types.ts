export interface ConfirmOperationCommand {
  operationId: string;
  clientId: string;
  expectedVersion: number;
}

export type MutationOutcome =
  | 'BOOKING_CREATED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'CANCELLATION_REQUESTED';

export type MutationResult = {
  bookingId: string;
  outcome: MutationOutcome;
  syncPending?: boolean;
};
