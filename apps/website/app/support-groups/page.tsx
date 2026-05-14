'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SupportGroupsList } from '@/features/support-groups/support-groups-list';
import type { SupportGroup } from '@/features/support-groups/support-groups.api';

export default function SupportGroupsPage() {
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState<SupportGroup | null>(null);

  const handleSelectGroup = (group: SupportGroup) => {
    setSelectedGroup(group);
  };

  const handleBook = () => {
    if (!selectedGroup) return;

    const loginUrl = `/login?redirect=/support-groups&groupId=${selectedGroup.id}`;
    router.push(loginUrl);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Support Groups
        </h1>
        <p style={{ opacity: 0.7 }}>
          Join our group therapy sessions for shared healing and community support
        </p>
      </div>

      <SupportGroupsList
        branchId={undefined}
        onSelectGroup={handleSelectGroup}
        selectedGroupId={selectedGroup?.id}
      />

      {selectedGroup && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={handleBook}
            style={{
              padding: '1rem 3rem',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {selectedGroup.isFull && selectedGroup.isWaitlistOnly
              ? `Join Waitlist for ${selectedGroup.title}`
              : `Book ${selectedGroup.title}`}
          </button>
        </div>
      )}
    </div>
  );
}