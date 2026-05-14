'use client';

import { useState } from 'react';
import type { Locale } from '../locale/locale';
import { t } from '../locale/dictionary';
import { QUESTIONS, OPTIONS, scoreLevel } from './questions';

interface Props {
  locale: Locale;
}

export function BurnoutTest({ locale }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const onAnswer = (qid: string, value: number) => setAnswers((a) => ({ ...a, [qid]: value }));

  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  const level = scoreLevel(total);
  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined);

  if (submitted) {
    const resultKey = level === 'low' ? 'burnout.result.low' : level === 'medium' ? 'burnout.result.medium' : 'burnout.result.high';
    return (
      <section style={{ padding: '3rem 2rem', maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ color: 'var(--primary-dark)' }}>{t(locale, 'burnout.title')}</h2>
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '1rem',
            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            marginTop: '1.5rem',
          }}
        >
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {locale === 'ar' ? 'نتيجتك:' : 'Your score:'} {total}/{QUESTIONS.length * 4}
          </p>
          <p style={{ marginTop: '0.5rem' }}>{t(locale, resultKey)}</p>
        </div>
        <button onClick={() => { setAnswers({}); setSubmitted(false); }} style={{ marginTop: '1.5rem' }}>
          {locale === 'ar' ? 'إعادة الاختبار' : 'Take again'}
        </button>
      </section>
    );
  }

  return (
    <section style={{ padding: '3rem 2rem', maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--primary-dark)' }}>{t(locale, 'burnout.title')}</h2>
      <p style={{ opacity: 0.8 }}>{t(locale, 'burnout.description')}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (allAnswered) setSubmitted(true);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '2rem' }}
      >
        {QUESTIONS.map((q, idx) => (
          <fieldset
            key={q.id}
            style={{
              border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
              borderRadius: '0.75rem',
              padding: '1rem',
            }}
          >
            <legend style={{ padding: '0 0.5rem', fontWeight: 600 }}>
              {idx + 1}. {locale === 'ar' ? q.textAr : q.textEn}
            </legend>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background:
                      answers[q.id] === opt.value
                        ? 'color-mix(in srgb, var(--primary) 20%, transparent)'
                        : 'transparent',
                    border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.value}
                    checked={answers[q.id] === opt.value}
                    onChange={() => onAnswer(q.id, opt.value)}
                    style={{ display: 'none' }}
                  />
                  {locale === 'ar' ? opt.labelAr : opt.labelEn}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          disabled={!allAnswered}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            background: allAnswered ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 40%, transparent)',
            color: 'white',
            border: 'none',
            cursor: allAnswered ? 'pointer' : 'not-allowed',
          }}
        >
          {t(locale, 'burnout.submit')}
        </button>
      </form>
    </section>
  );
}
