'use client';

import { Button } from '@sawaa/ui';
import { useLocale } from '@/components/locale-provider';
import { usePublishProgram } from '@/hooks/use-programs';

export function usePublishProgramButton() {
  return usePublishProgram();
}

export function PublishProgramButton({ programId }: { programId: string }) {
  const { t } = useLocale();
  const publish = usePublishProgram();
  return (
    <Button
      variant="default"
      disabled={publish.isPending}
      onClick={async () => {
        await publish.mutateAsync(programId);
      }}
    >
      {t('programs.publish')}
    </Button>
  );
}
