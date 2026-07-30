import type { MetadataRoute } from 'next';

/**
 * PWA manifest for sawaa.sa.
 *
 * - name / short_name: bilingual display labels
 * - start_url: the AR homepage (the default landing; the user is
 *   auto-redirected to EN via the sawaa-locale cookie if they prefer)
 * - display: 'standalone' — opens the site without browser chrome
 *   (good for the "Add to Home Screen" CTA on iOS / Android)
 * - theme_color / background_color: matched to the brand palette
 * - icons: a single 192px + 512px pair is the modern PWA spec minimum;
 *   iOS will use apple-icon.png automatically (Next 15 file convention)
 *
 * Scope: en + ar (covers the bilingual site). orientation locked to
 * portrait — we don't have a landscape-specific layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'مركز سواء للاستشارات الأسرية',
    short_name: 'سواء',
    description:
      'استشارات نفسية وأسرية متخصصة — حضورياً في الرياض أو عن بُعد عبر Zoom.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
    theme_color: '#0E4B43',
    background_color: '#ffffff',
    categories: ['health', 'lifestyle', 'medical'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}