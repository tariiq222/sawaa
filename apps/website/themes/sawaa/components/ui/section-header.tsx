import type { ReactNode } from 'react';

interface Props {
  tag: string;
  tagIcon?: ReactNode;
  title: ReactNode;
  subtitle?: string;
}

export function SectionHeader({ tag, tagIcon, title, subtitle }: Props) {
  return (
    <div className="text-center mb-14 max-w-[640px] mx-auto">
      <span
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-extrabold px-4 py-2 rounded-full mb-5 uppercase tracking-widest ring-1"
        style={{
          color: 'var(--sw-primary-700)',
          background: 'var(--sw-primary-50)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 10%, transparent)',
        }}
      >
        {tagIcon}
        {tag}
      </span>
      <h2
        className="font-extrabold leading-[1.15] mb-4 tracking-tight"
        style={{
          fontSize: 'clamp(1.875rem, 4.5vw, 2.875rem)',
          color: 'var(--sw-secondary-700)',
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="max-w-[520px] mx-auto leading-relaxed"
          style={{ color: 'var(--sw-neutral-600)', fontSize: '0.938rem' }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
