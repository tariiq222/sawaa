'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@sawaa/ui';
import { Button, Textarea } from '@sawaa/ui';
import { useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { cancelProgramSchema } from '@/lib/schemas/program.schema';

export function CancelProgramDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('programs.dialog.cancel.title')}</DialogTitle>
          <DialogDescription>{t('programs.dialog.cancel.desc')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = cancelProgramSchema.safeParse({ reason });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? 'Invalid input');
              return;
            }
            setError(null);
            setSubmitting(true);
            try {
              await onConfirm(parsed.data.reason);
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <DialogBody>
            <label className="block">
              <span className="text-sm font-medium">{t('programs.dialog.cancel.reasonLabel')}</span>
              <Textarea
                id="cancel-program-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="mt-1"
                rows={3}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "cancel-program-reason-error" : undefined}
              />
            </label>
            {error && (
              <p id="cancel-program-reason-error" className="text-sm text-(--text-error)">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? t('common.deleting') : t('programs.dialog.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
