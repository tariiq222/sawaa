'use client';

import Link from 'next/link';

export function SkipLink() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-[var(--sw-primary-700)] focus:font-bold focus:shadow-lg"
    >
      تخطي إلى المحتوى الرئيسي
    </Link>
  );
}
