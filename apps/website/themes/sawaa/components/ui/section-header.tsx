import type { ReactNode } from 'react';

interface Props {
  tag: string;
  tagIcon?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  tone?: 'default' | 'inverse';
}

export function SectionHeader({ tag, tagIcon, title, subtitle, tone = 'default' }: Props) {
  const inverse = tone === 'inverse';

  return (
    <div data-tone={tone} className="text-center mb-14 max-w-[640px] mx-auto">
      <span
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-extrabold px-4 py-2 rounded-full mb-5 uppercase ring-1"
        style={{
          color: inverse ? 'var(--sw-home-mint)' : 'var(--sw-primary-700)',
          background: inverse ? 'rgba(255, 255, 255, 0.08)' : 'var(--sw-primary-50)',
          boxShadow: inverse
            ? 'inset 0 0 0 1px rgba(217, 190, 138, 0.24)'
            : 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 10%, transparent)',
        }}
      >
        {tagIcon}
        {tag}
      </span>
      <h2
        className="font-extrabold leading-[1.15] mb-4 tracking-tight"
        style={{
          fontSize: 'clamp(1.875rem, 4.5vw, 2.875rem)',
          color: inverse ? 'var(--sw-home-white)' : 'var(--sw-secondary-700)',
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="max-w-[520px] mx-auto leading-relaxed"
          style={{
            color: inverse ? 'var(--sw-secondary-100)' : 'var(--sw-neutral-600)',
            fontSize: '0.938rem',
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
