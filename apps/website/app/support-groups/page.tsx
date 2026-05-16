'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useT } from '@/features/locale/locale-provider';
import { SupportGroupsList } from '@/features/support-groups/support-groups-list';
import { bookGroupSession } from '@/features/support-groups/support-groups.api';
import type { SupportGroup, BookGroupSessionResponse } from '@/features/support-groups/support-groups.api';
import { useCurrentClient } from '@/features/auth/public';

function SupportGroupsContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingGroupId = searchParams.get('groupId');
  const { client } = useCurrentClient();
  const [selectedGroup, setSelectedGroup] = useState<SupportGroup | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookGroupSessionResponse | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Auto-book when returning from login with groupId
  useEffect(() => {
    if (!pendingGroupId || !client || isBooking || bookingResult) return;

    setIsBooking(true);
    setBookingError(null);

    // Use credentials: 'include' — the httpOnly cookie handles auth
    bookGroupSession(pendingGroupId, '')
      .then((result) => {
        setBookingResult(result);
        // Clear groupId from URL
        router.replace('/support-groups');
      })
      .catch((err) => {
          setBookingError(err instanceof Error ? err.message : t('common.bookingFailed'));
      })
      .finally(() => setIsBooking(false));
  }, [pendingGroupId, client, isBooking, bookingResult, router]);

  const handleSelectGroup = (group: SupportGroup) => {
    setSelectedGroup(group);
    setBookingResult(null);
    setBookingError(null);
  };

  const handleBook = () => {
    if (!selectedGroup) return;

    if (client) {
      // Already logged in — book directly
      setIsBooking(true);
      setBookingError(null);
      bookGroupSession(selectedGroup.id, '')
        .then((result) => {
          setBookingResult(result);
        })
        .catch((err) => {
        setBookingError(err instanceof Error ? err.message : t('common.bookingFailed'));
        })
        .finally(() => setIsBooking(false));
    } else {
      const loginUrl = `/login?redirect=/support-groups&groupId=${selectedGroup.id}`;
      router.push(loginUrl);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {t('supportGroups.title')}
        </h1>
        <p style={{ opacity: 0.7 }}>
          {t('supportGroups.subtitle')}
        </p>
      </div>

      {bookingResult && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, var(--success) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            color: 'var(--success)',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {bookingResult.type === 'BOOKED'
            ? t('supportGroups.booked')
            : `${t('supportGroups.waitlisted')} (${bookingResult.waitlistPosition}).`}
        </div>
      )}

      {bookingError && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            color: 'var(--error)',
            textAlign: 'center',
          }}
        >
          {bookingError}
        </div>
      )}

      {isBooking && (
        <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.7 }}>
          {t('supportGroups.bookingInProgress')}
        </div>
      )}

      <SupportGroupsList
        branchId={undefined}
        onSelectGroup={handleSelectGroup}
        selectedGroupId={selectedGroup?.id}
      />

      {selectedGroup && !bookingResult && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={handleBook}
            disabled={isBooking}
            style={{
              padding: '1rem 3rem',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: isBooking ? 'not-allowed' : 'pointer',
              opacity: isBooking ? 0.7 : 1,
            }}
          >
            {selectedGroup.isFull && selectedGroup.isWaitlistOnly
              ? `${t('supportGroups.joinWaitlist')} ${selectedGroup.title}`
              : `${t('supportGroups.book')} ${selectedGroup.title}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SupportGroupsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
      <SupportGroupsContent />
    </Suspense>
  );
}
