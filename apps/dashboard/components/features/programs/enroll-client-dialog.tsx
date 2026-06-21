'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@sawaa/ui';
import { Button, Input } from '@sawaa/ui';
import { useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { useClients } from '@/hooks/use-clients';
import { useEnrollClientInProgram } from '@/hooks/use-programs';
import { enrollInProgramSchema } from '@/lib/schemas/program.schema';

export function EnrollClientDialog({
  open,
  onOpenChange,
  programId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
}) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enroll = useEnrollClientInProgram();

  const clients = useClients();
  const filtered = (clients.clients ?? []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name ?? '').toLowerCase().includes(s) || (c.phone ?? '').includes(search);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('programs.dialog.enroll.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input
              placeholder={t('programs.dialog.enroll.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded border border-(--border)">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-(--text-muted)">—</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`block w-full px-3 py-2 text-start text-sm hover:bg-(--surface-muted) ${
                      selectedId === c.id ? 'bg-(--surface-muted)' : ''
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="font-medium">{c.name ?? ''}</span>
                    <span className="ms-2 text-(--text-muted)">{c.phone ?? ''}</span>
                  </button>
                ))
              )}
            </div>
            {error && <p className="text-sm text-(--text-error)">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="default"
            disabled={!selectedId || submitting}
            onClick={async () => {
              if (!selectedId) return;
              const parsed = enrollInProgramSchema.safeParse({ clientId: selectedId });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Invalid client');
                return;
              }
              setError(null);
              setSubmitting(true);
              try {
                await enroll.mutateAsync({ programId, clientId: parsed.data.clientId });
                onOpenChange(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to enroll');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? t('common.saving') : t('programs.dialog.enroll.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
