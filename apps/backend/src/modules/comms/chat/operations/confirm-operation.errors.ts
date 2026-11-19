import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChatOperationStatus, ChatOperationType } from '@prisma/client';
import type { MutationOutcome } from './confirm-operation.types';

export class OperationExecutionError extends Error {
  constructor(readonly publicCode: string, message: string) {
    super(message);
  }
}

export const TERMINAL_STATUSES = new Set<ChatOperationStatus>([
  ChatOperationStatus.SUCCEEDED,
  ChatOperationStatus.FAILED,
  ChatOperationStatus.DECLINED,
  ChatOperationStatus.EXPIRED,
]);

export function toOperationErrorCode(error: unknown): string {
  if (error instanceof OperationExecutionError) return error.publicCode;
  if (error instanceof ConflictException) return 'BOOKING_CONFLICT';
  if (error instanceof BadRequestException) return 'VALIDATION_FAILED';
  return 'EXECUTION_FAILED';
}

export function defaultMutationOutcome(type: ChatOperationType): MutationOutcome {
  if (type === ChatOperationType.RESCHEDULE_BOOKING) return 'BOOKING_RESCHEDULED';
  if (type === ChatOperationType.CANCEL_BOOKING) return 'BOOKING_CANCELLED';
  return 'BOOKING_CREATED';
}

export function operationResultBody(
  status: ChatOperationStatus,
  outcome: string,
  syncPending = false,
): string {
  if (outcome === 'CANCELLATION_CONSENT_REQUIRED') return 'لإلغاء الموعد، افتح تفاصيل الموعد وراجع شروط الإلغاء والاسترداد ثم أكّد موافقتك.';
  if (status === ChatOperationStatus.FAILED) return 'تعذر تنفيذ الإجراء. يمكنك إعداد الطلب من جديد.';
  if (outcome === 'BOOKING_RESCHEDULED') {
    return syncPending
      ? 'تمت إعادة جدولة الموعد، ويجري الآن مزامنة رابط الاجتماع عن بُعد.'
      : 'تمت إعادة جدولة الموعد بنجاح.';
  }
  if (outcome === 'BOOKING_CANCELLED') return 'تم إلغاء الموعد بنجاح.';
  if (outcome === 'CANCELLATION_REQUESTED') return 'تم تسجيل طلب إلغاء الموعد للمراجعة.';
  return 'تم تأكيد الحجز بنجاح.';
}
