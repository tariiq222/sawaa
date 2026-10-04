'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, Button, Textarea, Input } from '@sawaa/ui';
import { useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { useProgramCancellationPreview } from '@/hooks/use-programs';
import type { CancelProgramPayload, ProgramCancellationResult } from '@/lib/types/program';

type CancelProgramDialogProps = {
  open: boolean; programId: string; onOpenChange: (open: boolean) => void;
  onConfirm: (payload: CancelProgramPayload) => Promise<ProgramCancellationResult>;
};

export function CancelProgramDialog(props: CancelProgramDialogProps) {
  // Closing unmounts the draft, so each opening starts with fresh confirmation.
  return props.open ? <CancelProgramDialogDraft {...props} /> : null;
}

function CancelProgramDialogDraft({ open, programId, onOpenChange, onConfirm }: CancelProgramDialogProps) {
  const { t } = useLocale();
  const query = useProgramCancellationPreview(programId, open);
  const preview = query.data;
  const [reason, setReason] = useState('');
  const [amountRevision, setAmountRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProgramCancellationResult | null>(null);
  const money = (amount: number, currency: string) => `${(amount / 100).toFixed(2)} ${currency}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('programs.dialog.cancel.title')}</DialogTitle>
          <DialogDescription>{t('programs.dialog.cancel.desc')}</DialogDescription>
        </DialogHeader>
        {result ? <DialogBody>
          <p role="status">{t('programs.dialog.cancel.success')} {result.cancelledEnrollments}</p>
          <p>{t('programs.dialog.cancel.skipped')} {result.skippedEnrollments}</p>
          <p>{t('programs.dialog.cancel.pending')}</p>
          <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogBody> : <form className="space-y-4" onSubmit={async e => {
          e.preventDefault();
          if (!preview || query.isFetching || submitting) return;
          if (!reason.trim()) { setError(t('programs.dialog.cancel.reasonRequired')); return; }
          const form = new FormData(e.currentTarget);
          const refunds: { bookingId: string; amount: number }[] = [];
          if (preview.hasStarted) {
            for (const participant of preview.participants.filter(p => p.paidAmount > 0)) {
              const entered = String(form.get(`refund:${participant.bookingId}`) ?? '');
              if (!/^\d+(\.\d{1,2})?$/.test(entered)) { setError(t('programs.dialog.cancel.invalidAmount')); return; }
              const amount = Math.round(Number(entered) * 100);
              if (!Number.isSafeInteger(amount) || amount > participant.maxRefundAmount) { setError(t('programs.dialog.cancel.invalidAmount')); return; }
              refunds.push({ bookingId: participant.bookingId, amount });
            }
          }
          setError(null); setSubmitting(true);
          try { setResult(await onConfirm({ reason: reason.trim(), quoteToken: preview.quoteToken, ...(preview.hasStarted ? { refunds } : {}) })); }
          catch (failure) {
            if ((failure as { status?: number }).status === 409) {
              setAmountRevision(revision => revision + 1);
              await query.refetch();
              setError(t('programs.dialog.cancel.quoteChanged'));
            } else setError(t('common.errorLoading'));
          } finally { setSubmitting(false); }
        }}>
          <DialogBody className="space-y-4">
            {query.isFetching && <p role="status">{t('common.loading')}</p>}
            {query.isError && <p role="alert">{t('common.errorLoading')}</p>}
            {preview && <>
              <p>{t(preview.hasStarted ? 'programs.dialog.cancel.afterStart' : 'programs.dialog.cancel.beforeStart')}</p>
              {preview.participants.map(p => <div key={`${preview.quoteToken}:${amountRevision}:${p.bookingId}`} className="space-y-1 border-b pb-3">
                <p className="font-medium">{p.clientName} · #{p.bookingNumber}</p>
                <p className="text-sm">{t('programs.dialog.cancel.paid')} {money(p.paidAmount, p.currency)} · {t('programs.dialog.cancel.previous')} {money(p.alreadyRefundedAmount + p.pendingRefundAmount, p.currency)}</p>
                <p className="text-sm">{t('programs.dialog.cancel.maximum')} {money(p.maxRefundAmount, p.currency)}</p>
                {preview.hasStarted && p.paidAmount > 0 ? <label className="block">
                  <span>{t('programs.dialog.cancel.amount')} — {p.clientName}</span>
                  <Input type="number" min="0" max={p.maxRefundAmount / 100} step="0.01" name={`refund:${p.bookingId}`} defaultValue="" />
                </label> : <p>{t('programs.dialog.cancel.amount')} {money(p.refundAmount ?? 0, p.currency)}</p>}
              </div>)}
            </>}
            <label className="block">
              <span className="text-sm font-medium">{t('programs.dialog.cancel.reasonLabel')}</span>
              <Textarea id="cancel-program-reason" value={reason} onChange={e => setReason(e.target.value)} required className="mt-1" rows={3} />
            </label>
            {error && <p role="alert" className="text-sm text-(--text-error)">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="destructive" disabled={submitting || query.isFetching || query.isError || !preview}>{submitting ? t('programs.dialog.cancel.processing') : t('programs.dialog.cancel.confirm')}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  );
}
