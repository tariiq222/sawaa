'use client';

export function BookingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      <div
        style={{
          height: '1.5rem',
          width: '40%',
          borderRadius: 'var(--radius)',
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '1rem',
            border: '1px solid color-mix(in srgb, var(--primary) 10%, transparent)',
            borderRadius: 'var(--radius)',
            background: 'color-mix(in srgb, var(--primary) 3%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              height: '1rem',
              width: '60%',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              animationDelay: `${i * 100}ms`,
            }}
          />
          <div
            style={{
              height: '0.875rem',
              width: '80%',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              animationDelay: `${i * 100 + 50}ms`,
            }}
          />
          <div
            style={{
              height: '0.875rem',
              width: '30%',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              animationDelay: `${i * 100 + 100}ms`,
            }}
          />
        </div>
      ))}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
