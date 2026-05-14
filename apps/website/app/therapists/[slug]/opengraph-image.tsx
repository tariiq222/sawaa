import { ImageResponse } from 'next/og';
import { getPublicBrandingForSsr } from '@/features/branding/public';

export const runtime = 'edge';

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    openGraph: {
      title: `Therapist: ${slug}`,
      description: 'Book an appointment with our professional therapist',
      images: [{ url: `/therapists/${slug}/opengraph-image`, width: 1200, height: 630 }],
    },
  };
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
            backgroundColor: '#354FD8',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '60px',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '60px',
              backgroundColor: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            👨‍⚕️
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '8px',
            }}
          >
            {slug}
          </div>
          <div
            style={{
              fontSize: '18px',
              color: '#64748b',
              marginBottom: '24px',
            }}
          >
            Professional Therapist
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#354FD8',
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