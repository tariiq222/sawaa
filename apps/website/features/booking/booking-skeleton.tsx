'use client';

export function BookingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جارٍ التحميل</span>

      <div
        className="h-8 w-2/5 rounded-lg sw-skel"
        style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
      />
      <div
        className="h-4 w-3/4 max-w-[44ch] mb-3 rounded-md sw-skel"
        style={{
          background: 'color-mix(in srgb, var(--sw-secondary-700) 5%, transparent)',
          animationDelay: '60ms',
        }}
      />

      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 sm:p-5 rounded-[1.25rem] bg-white"
          style={{
            border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
            boxShadow: 'var(--sw-shadow-xs)',
          }}
        >
          <div
            className="h-11 w-11 shrink-0 rounded-full sw-skel"
            style={{
              background: 'color-mix(in srgb, var(--sw-secondary-700) 7%, transparent)',
              animationDelay: `${i * 80}ms`,
            }}
          />
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div
              className="h-3.5 w-3/5 rounded-md sw-skel"
              style={{
                background: 'color-mix(in srgb, var(--sw-secondary-700) 7%, transparent)',
                animationDelay: `${i * 80 + 40}ms`,
              }}
            />
            <div
              className="h-3 w-2/5 rounded-md sw-skel"
              style={{
                background: 'color-mix(in srgb, var(--sw-secondary-700) 5%, transparent)',
                animationDelay: `${i * 80 + 80}ms`,
              }}
            />
          </div>
          <div
            className="h-6 w-14 shrink-0 rounded-md sw-skel"
            style={{
              background: 'color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
              animationDelay: `${i * 80 + 120}ms`,
            }}
          />
        </div>
      ))}

      <style jsx>{`
        @keyframes sw-skel-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        :global(.sw-skel) {
          animation: sw-skel-pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.sw-skel) {
            animation: none;
            opacity: 0.75;
          }
        }
      `}</style>
    </div>
  );
}
