import { ImageResponse } from 'next/og';
import { getPublicBrandingForSsr } from '@/features/branding/public';

export const runtime = 'edge';

/**
 * Edge-rendered OpenGraph image for /blog and /blog/[slug].
 * Blog posts themselves use slug-specific images (the slug renders
 * via the dynamic route); this serves as the index/blog fallback
 * for social shares.
 */
export default async function OpenGraphImage() {
  const branding = await getPublicBrandingForSsr();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '200px',
            backgroundColor: '#0E4B43',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '40px',
          }}
        >
          <div
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '70px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '72px',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(85,204,176,0.20)',
            }}
          >
            📝
          </div>
          <div
            style={{
              fontSize: '40px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '12px',
            }}
          >
            مدوّنة مركز سواء
          </div>
          <div
            style={{
              fontSize: '20px',
              color: '#64748b',
              marginBottom: '32px',
              textAlign: 'center',
              padding: '0 40px',
            }}
          >
            مقالات عن الصحة النفسية والعلاقات الأسرية
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#0E4B43',
            }}
          >
            {branding.organizationNameAr}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}