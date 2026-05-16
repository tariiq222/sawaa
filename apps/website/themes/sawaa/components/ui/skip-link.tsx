'use client';

import Link from 'next/link';

export function SkipLink() {
  return (
    <Link
      href="#main-content"
      className="absolute -top-20 start-4 z-[9999] rounded-lg bg-white px-4 py-2.5 font-bold text-[var(--sw-primary-700)] shadow-lg transition-[top] focus:top-4"
    >
      تخطي إلى المحتوى الرئيسي
    </Link>
  );
}
