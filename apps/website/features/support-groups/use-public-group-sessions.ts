'use client';

import { useState, useEffect } from 'react';
import {
  getPublicGroupSessions,
  type SupportGroup,
} from './support-groups.api';

export function usePublicGroupSessions(branchId?: string) {
  const [sessions, setSessions] = useState<SupportGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getPublicGroupSessions(branchId);
        if (!cancelled) {
          setSessions(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load group sessions');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchSessions();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { sessions, isLoading, error };
}