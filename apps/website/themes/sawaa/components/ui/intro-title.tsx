import type { SectionIntro } from '@/features/site-content/public';

interface Props {
  intro: SectionIntro;
  breakBeforeSuffix?: boolean;
}

export function IntroTitle({ intro, breakBeforeSuffix = false }: Props) {
  const prefix = intro.titlePrefix.trim();
  const highlight = intro.titleHighlight.trim();
  const suffix = intro.titleSuffix.trim();

  return (
    <>
      {prefix ? <>{prefix} </> : null}
      {highlight ? (
        <span style={{ color: 'var(--sw-primary-500)' }}>{highlight}</span>
      ) : null}
      {suffix ? (
        <>
          {breakBeforeSuffix ? <br /> : ' '}
          {suffix}
        </>
      ) : null}
    </>
  );
}
