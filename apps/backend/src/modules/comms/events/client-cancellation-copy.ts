import type { StaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import type { ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';

export function clientCancellationBody(intent?: ClientCancellationIntent): string {
  if (!intent) return 'نأسف، تم إلغاء موعدك.';
  const refund = intent.refund;
  const money = `${((refund.refundAmount + refund.pendingRefundAmount) / 100).toFixed(2)} ${refund.currency}`;
  switch (refund.status) {
    case 'CREDIT_RETURNED': return 'تم إلغاء موعدك وإعادة الجلسة إلى رصيد الباقة.';
    case 'NOT_APPLICABLE': return 'تم إلغاء موعدك. لا توجد دفعة لاستردادها.';
    case 'NO_REFUND': return 'تم إلغاء موعدك. لا يوجد مبلغ مستحق للاسترداد وفق السياسة المعروضة.';
    case 'PENDING_REVIEW': return `تم إلغاء موعدك. طلب استرداد ${money} بانتظار المراجعة.`;
    case 'PROCESSING': return `تم إلغاء موعدك. استرداد ${money} قيد المعالجة.`;
  }
}
export function refundOutcomeBody(status: string, amount: number, currency: string): string {
  const money = `${(amount / 100).toFixed(2)} ${currency}`;
  if (status === 'COMPLETED') return `تم استرداد ${money} بنجاح.`;
  if (status === 'FAILED' || status === 'DENIED') return `تعذر استرداد ${money}. يمكنك التواصل مع المركز للمتابعة.`;
  return `طلب استرداد ${money} بانتظار المراجعة. لم يكتمل رد المبلغ بعد.`;
}

export function centerCancellationBody(intent: StaffCancellationIntent): string {
  const amount = intent.refund.refundAmount + intent.refund.pendingRefundAmount;
  const money = `${(amount / 100).toFixed(2)} ${intent.refund.currency}`;
  return amount > 0 ? `${intent.reason}. طلب استرداد ${money} قيد المعالجة أو المراجعة. لم يكتمل رد المبلغ بعد.` : `${intent.reason}. لا يوجد مبلغ استرداد إضافي.`;
}
