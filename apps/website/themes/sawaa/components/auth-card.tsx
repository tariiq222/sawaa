import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  return (
    <section
      className="sw-section-mint relative overflow-hidden flex items-center justify-center px-5 pb-16 pt-32 sm:pt-36"
      style={{ minHeight: 'calc(100vh - 120px)' }}
    >
      <div
        className="absolute -top-20 -start-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 8%, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -end-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 4%, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 -end-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 5%, transparent)' }}
        aria-hidden="true"
      />

      <div
        className="relative z-10 max-w-[440px] w-full mx-auto rounded-[28px] p-8 sm:p-10"
        style={{
          background: 'var(--sw-neutral-0)',
          boxShadow: 'var(--sw-shadow-xl)',
        }}
      >
        <h1 className="text-2xl font-extrabold text-[var(--sw-secondary-700)] text-center mb-1.5">
          {title}
        </h1>
        <p className="text-[0.9375rem] text-[var(--sw-body)] text-center leading-relaxed mb-7">
          {subtitle}
        </p>

        {children}

        {footer && (
          <p className="mt-5 text-center text-sm text-[var(--sw-body)]">{footer}</p>
        )}
      </div>
    </section>
  );
}
