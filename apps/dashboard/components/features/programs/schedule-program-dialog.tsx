'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  Button,
  DateTimeInput,
} from '@sawaa/ui';
import { useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { scheduleProgramSchema } from '@/lib/schemas/program.schema';

export function ScheduleProgramDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  onConfirm: (startDate: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [startDate, setStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('programs.dialog.schedule.title')}</DialogTitle>
          <DialogDescription>{t('programs.dialog.schedule.desc')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = scheduleProgramSchema.safeParse({ startDate });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? 'Invalid input');
              return;
            }
            setError(null);
            setSubmitting(true);
            try {
              await onConfirm(parsed.data.startDate);
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <DialogBody>
            <label className="block">
              <span className="text-sm font-medium">{t('programs.detail.startDate')}</span>
              <DateTimeInput
                value={startDate}
                onChange={(value: string) => setStartDate(value)}
                required
                className="mt-1"
              />
            </label>
            {error && <p className="text-sm text-(--text-error)">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="default" disabled={submitting}>
              {submitting ? t('common.saving') : t('programs.schedule')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
