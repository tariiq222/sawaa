import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', minHeight: '50vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '6rem 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '4.5rem', fontWeight: 700, color: 'var(--primary)' }}>404</h1>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          الصفحة غير موجودة
        </h2>
        <p style={{ maxWidth: '24rem', fontSize: '0.875rem', opacity: 0.6 }}>
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
      </div>
      <Link
        href="/"
        style={{
          padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem',
          background: 'var(--primary)',
          color: 'var(--on-primary, #fff)',
          fontSize: '0.875rem',
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
