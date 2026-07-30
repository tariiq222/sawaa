import { ImageResponse } from 'next/og';
import { getPublicBrandingForSsr } from '@/features/branding/public';

export const runtime = 'edge';
export const alt = 'احجز جلستك في مركز سواء';

/**
 * Edge-rendered OpenGraph image for the /booking landing page.
 * Same template as therapists/[slug] but with a calendar visual
 * (SVG embedded inline so no external assets are needed in Edge
 * runtime). Generated dynamically so the brand color stays in sync
 * with PublicBranding.
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
            backgroundColor: '#55CCB0',
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
              boxShadow: '0 8px 24px rgba(14,75,67,0.15)',
            }}
          >
            📅
          </div>
          <div
            style={{
              fontSize: '40px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '12px',
              textAlign: 'center',
              padding: '0 40px',
            }}
          >
            احجز جلستك الآن
          </div>
          <div
            style={{
              fontSize: '20px',
              color: '#64748b',
              marginBottom: '32px',
              textAlign: 'center',
            }}
          >
            استشارات أسرية ونفسية — حضورياً أو عن بُعد
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