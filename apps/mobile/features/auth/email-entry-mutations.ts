import { useMutation } from '@tanstack/react-query';
import { emailEntryService } from '@/services/email-entry';
export function useEmailEntryMutations() {
  // Do not store server proof responses as mutation results. The operation
  // returns void; only the local screen reducer owns the continuation state.
  const run = useMutation({ mutationFn: (operation: () => Promise<void>) => operation(), gcTime: 0, retry: false });
  return { execute: run.mutateAsync, api: emailEntryService };
}
