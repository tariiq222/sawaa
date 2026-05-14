'use client';

import { usePublicGroupSessions } from './use-public-group-sessions';
import { SupportGroupCard } from './support-group-card';
import type { SupportGroup } from './support-groups.api';

interface SupportGroupsListProps {
  branchId?: string;
  onSelectGroup?: (group: SupportGroup) => void;
  selectedGroupId?: string;
}

export function SupportGroupsList({
  branchId,
  onSelectGroup,
  selectedGroupId,
}: SupportGroupsListProps) {
  const { sessions, isLoading, error } = usePublicGroupSessions(branchId);

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={`skeleton-${i}`}
            className="animate-pulse rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 h-6 w-24 rounded bg-muted" />
            <div className="mb-4 h-4 w-full rounded bg-muted" />
            <div className="mb-4 h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No support groups available at this time.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((group) => (
        <SupportGroupCard
          key={group.id}
          group={group}
          isSelected={selectedGroupId === group.id}
          onSelect={onSelectGroup}
        />
      ))}
    </div>
  );
}