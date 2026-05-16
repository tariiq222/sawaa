import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Content is always visible. The `delay` prop is accepted for API compatibility
// with the tempsawaa source but is unused — we keep this a static, SSR-friendly
// wrapper to avoid content being hidden below the fold.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- delay accepted for API compat, intentionally unused
export function AnimatedSection({ children, className = '', delay: _delay = 0 }: Props) {
  return <div className={className}>{children}</div>;
}
