'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentClient } from './use-current-client';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { client, isLoading } = useCurrentClient();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && client === null) {
      router.push('/login');
    }
  }, [client, isLoading, router]);

  if (isLoading) {
    return (
      fallback ?? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ opacity: 0.6 }}>Loading...</div>
        </div>
      )
    );
  }

  if (client === null) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
