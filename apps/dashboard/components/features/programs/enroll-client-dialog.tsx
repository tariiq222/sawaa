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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enroll = useEnrollClientInProgram();

  const clients = useClients();
  const filtered = clients.isFetching ? [] : (clients.clients ?? []);

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
              value={clients.search}
              onChange={(e) => {
                setSelectedId(null);
                clients.setSearch(e.target.value);
              }}
            />
            <div className="max-h-64 overflow-y-auto rounded border border-(--border)">
              {clients.isFetching ? (
                <p className="p-4 text-sm text-(--text-muted)">{t('common.loading')}</p>
              ) : filtered.length === 0 ? (
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
            {clients.meta && clients.meta.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-(--text-muted)">
                <span className="tabular-nums">
                  {t('table.page')} {clients.page} {t('table.of')} {clients.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={!clients.meta.hasPreviousPage} onClick={() => { setSelectedId(null); clients.setPage(clients.page - 1); }}>
                    {t('table.previous')}
                  </Button>
                  <Button variant="outline" disabled={!clients.meta.hasNextPage} onClick={() => { setSelectedId(null); clients.setPage(clients.page + 1); }}>
                    {t('table.next')}
                  </Button>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-(--text-error)">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="default"
            disabled={!selectedId || submitting || clients.isFetching}
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
