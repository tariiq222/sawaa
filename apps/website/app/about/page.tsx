import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { getLocale, localeDir } from '@/features/locale/locale';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/about',
    titleAr: 'من نحن',
    descriptionAr:
      'تعرّف على مركز سواء: رسالتنا، فريقنا، وقيمنا في تقديم استشارات أسرية ونفسية احترافية وآمنة في المملكة العربية السعودية.',
  });
}

export default async function AboutRoute() {
  const Layout = theme.Layout;
  const locale = await getLocale();
  const dir = localeDir(locale);
  const branding = await getPublicBrandingForSsr();

  return (
    <Layout>
      <main dir={dir} className="sw-section-cream relative pt-[140px] sm:pt-[160px] pb-20">
        <div className="relative max-w-[920px] mx-auto px-5 sm:px-6 md:px-8">
          <header className="mb-10">
            <h1
              className="text-3xl sm:text-4xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              من نحن
            </h1>
            <p
              className="text-base sm:text-lg leading-loose"
              style={{ color: 'var(--sw-neutral-700)' }}
            >
              {branding.productTagline ??
                'مركز متخصص في تقديم الاستشارات الأسرية والنفسية بأعلى معايير الاحترافية والسرية، حضورياً في الرياض وعن بُعد عبر Zoom.'}
            </p>
          </header>

          <section className="mb-12">
            <h2
              className="text-2xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              رسالتنا
            </h2>
            <p
              className="text-[0.95rem] sm:text-base leading-loose"
              style={{ color: 'var(--sw-neutral-600)' }}
            >
              نوفّر استشارات أسرية ونفسية متخصصة تساعد الأفراد والعائلات على مواجهة
              التحديات الحياتية والعلائقية والنفسية بأسلوب علمي وسرّي. نلتزم بأعلى معايير
              الجودة الأخلاقية والمهنية، ويعمل معنا أخصائيون سعوديون مرخّصون من وزارة الصحة.
            </p>
          </section>

          <section className="mb-12">
            <h2
              className="text-2xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              قيمنا
            </h2>
            <ul
              className="space-y-3 text-[0.95rem] sm:text-base leading-loose"
              style={{ color: 'var(--sw-neutral-600)' }}
            >
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>السرية التامة:</strong>{' '}
                كل ما يُطرح في الجلسة يبقى بينك وبين الأخصائي. لا نشارك أي معلومة
                مع أي طرف دون موافقتك الصريحة.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>الكفاءة المهنية:</strong>{' '}
                فريقنا من أخصائيين سعوديين حاصلين على مؤهلات معتمدة وخبرة عملية في الإرشاد
                الأسري والعلاج النفسي.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>المرونة:</strong>{' '}
                جلسات حضورية في الرياض أو عن بُعد عبر Zoom — في الوقت الذي يناسبك.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>الالتزام الأخلاقي:</strong>{' '}
                نتبع ميثاق أخلاقيات المهنة ونحيل إلى الأخصائيين المتخصصين عند الحاجة.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2
              className="text-2xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              خدماتنا
            </h2>
            <ul
              className="space-y-3 text-[0.95rem] sm:text-base leading-loose"
              style={{ color: 'var(--sw-neutral-600)' }}
            >
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>الاستشارة الفردية:</strong>{' '}
                جلسات فردية مع أخصائي نفسي أو مرشد أسري.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>الاستشارة الزوجية:</strong>{' '}
                جلسات للأزواج لتحسين التواصل وحل الخلافات.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>الاستشارة الأسرية:</strong>{' '}
                جلسات تشمل أفراد الأسرة لحل المشكلات الأسرية.
              </li>
              <li>
                <strong style={{ color: 'var(--sw-secondary-700)' }}>البرامج الجماعية:</strong>{' '}
                برامج بإشراف مختصين (دعم الأزمات، التعافي، الأمومة).
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2
              className="text-2xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              الشفافية في الأسعار
            </h2>
            <p
              className="text-[0.95rem] sm:text-base leading-loose"
              style={{ color: 'var(--sw-neutral-600)' }}
            >
              الأسعار واضحة ومعلنة عند الحجز، وتشمل ضريبة القيمة المضافة حيثما تنطبق
              نظاماً. تتوفر خصومات للحزم المتعددة، ويمكن إلغاء أو إعادة جدولة المواعيد وفق
              سياسة الإلغاء المعلنة. للمبالغ المستردة، راجع{' '}
              <a
                href="/terms"
                className="underline"
                style={{ color: 'var(--sw-primary-600)' }}
              >
                الشروط والأحكام
              </a>
              .
            </p>
          </section>

          <section className="mb-6">
            <h2
              className="text-2xl font-extrabold mb-4"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              تواصل معنا
            </h2>
            <p
              className="text-[0.95rem] sm:text-base leading-loose"
              style={{ color: 'var(--sw-neutral-600)' }}
            >
              للاستفسار العام، تواصل عبر{' '}
              <a
                href="/contact"
                className="underline"
                style={{ color: 'var(--sw-primary-600)' }}
              >
                صفحة التواصل
              </a>
              . للحجز المباشر، تفضل بزيارة{' '}
              <a
                href="/booking"
                className="underline"
                style={{ color: 'var(--sw-primary-600)' }}
              >
                صفحة الحجز
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </Layout>
  );
}
