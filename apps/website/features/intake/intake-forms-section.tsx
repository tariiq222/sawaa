'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { PublicFetchError } from '@/lib/public-fetch';
import {
  fetchApplicableIntakeForms,
  submitIntakeResponse,
  type IntakeAnswer,
  type IntakeField,
  type IntakeForm,
} from './intake.api';

const INPUT =
  'w-full py-3 px-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';

interface IntakeFormsSectionProps {
  bookingId: string;
  /** Required to fetch SERVICE-scoped forms; without it the section is inert. */
  serviceId?: string | null;
  employeeId?: string | null;
  branchId?: string | null;
  /** Gate fetch when the booking is not in a fillable state. */
  enabled?: boolean;
}

export function IntakeFormsSection({
  bookingId,
  serviceId,
  employeeId,
  branchId,
  enabled = true,
}: IntakeFormsSectionProps) {
  const tt = useT();
  const canFetch = enabled && !!serviceId;

  const { data: forms, isLoading } = useQuery({
    queryKey: ['client', 'intake', 'applicable', serviceId, employeeId, branchId],
    queryFn: () =>
      fetchApplicableIntakeForms({
        serviceId: serviceId as string,
        employeeId: employeeId ?? undefined,
        branchId: branchId ?? undefined,
      }),
    enabled: canFetch,
  });

  if (!canFetch || isLoading) return null;
  if (!forms || forms.length === 0) return null;

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)] flex flex-col gap-5">
      <h2 className="font-bold text-[var(--sw-secondary-700)] inline-flex items-center gap-2">
        <ClipboardList size={16} aria-hidden="true" /> {tt('intake.title')}
      </h2>
      <p className="text-sm text-[var(--sw-body)] -mt-2 leading-relaxed">
        {tt('intake.subtitle')}
      </p>
      {forms.map((form) => (
        <IntakeFormCard key={form.id} bookingId={bookingId} form={form} />
      ))}
    </section>
  );
}

function fieldLabel(field: IntakeField, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? field.labelAr || field.labelEn : field.labelEn || field.labelAr;
}

function IntakeFormCard({ bookingId, form }: { bookingId: string; form: IntakeForm }) {
  const tt = useT();
  const locale = useLocale();
  const [answers, setAnswers] = useState<Record<string, IntakeAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formName = locale === 'ar' ? form.nameAr || form.nameEn : form.nameEn || form.nameAr;
  const fields = [...form.fields].sort((a, b) => a.position - b.position);

  function setAnswer(fieldId: string, value: IntakeAnswer) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toggleCheckbox(fieldId: string, option: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  }

  function firstMissingRequired(): IntakeField | null {
    for (const field of fields) {
      if (!field.isRequired) continue;
      const value = answers[field.id];
      const empty = Array.isArray(value)
        ? value.length === 0
        : !value || value.trim() === '';
      if (empty) return field;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = firstMissingRequired();
    if (missing) {
      setError(`${tt('intake.required')}: ${fieldLabel(missing, locale)}`);
      return;
    }
    setIsSubmitting(true);
    try {
      await submitIntakeResponse(bookingId, { formId: form.id, answers });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof PublicFetchError) {
        const body = err.body as { message?: string } | undefined;
        setError(body?.message ?? tt('intake.submitError'));
      } else {
        setError(tt('intake.submitError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl p-4 border border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] flex items-start gap-3">
        <CheckCircle2 size={18} className="shrink-0 text-[var(--success)] mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-bold text-[var(--sw-secondary-700)] text-sm">{formName}</p>
          <p className="text-sm text-[var(--sw-body)] mt-0.5">{tt('intake.submitted')}</p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-4 sm:p-5 border border-[var(--sw-neutral-100)] bg-[var(--sw-neutral-50)] flex flex-col gap-4"
    >
      <h3 className="font-bold text-[var(--sw-secondary-700)]">{formName}</h3>

      {fields.map((field) => (
        <IntakeFieldInput
          key={field.id}
          field={field}
          locale={locale}
          value={answers[field.id]}
          onChange={(v) => setAnswer(field.id, v)}
          onToggleCheckbox={(opt) => toggleCheckbox(field.id, opt)}
        />
      ))}

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)] inline-flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start px-5 py-2.5 rounded-full font-bold text-sm bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
      >
        {isSubmitting ? tt('intake.submitting') : tt('intake.submit')}
      </button>
    </form>
  );
}

function IntakeFieldInput({
  field,
  locale,
  value,
  onChange,
  onToggleCheckbox,
}: {
  field: IntakeField;
  locale: 'ar' | 'en';
  value: IntakeAnswer | undefined;
  onChange: (value: string) => void;
  onToggleCheckbox: (option: string) => void;
}) {
  const label = fieldLabel(field, locale);
  const stringValue = typeof value === 'string' ? value : '';
  const arrayValue = Array.isArray(value) ? value : [];
  const options = field.options ?? [];
  const labelEl = (
    <label className="block text-sm font-medium text-[var(--sw-secondary-700)] mb-1.5">
      {label}
      {field.isRequired && <span className="text-[var(--error)] ms-1">*</span>}
    </label>
  );

  switch (field.fieldType) {
    case 'TEXTAREA':
      return (
        <div>
          {labelEl}
          <textarea
            rows={3}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            className={`${INPUT} resize-none`}
          />
        </div>
      );
    case 'NUMBER':
      return (
        <div>
          {labelEl}
          <input
            type="number"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT}
          />
        </div>
      );
    case 'DATE':
      return (
        <div>
          {labelEl}
          <input
            type="date"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT}
            suppressHydrationWarning
          />
        </div>
      );
    case 'SELECT':
      return (
        <div>
          {labelEl}
          <select
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT}
          >
            <option value="" disabled />
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    case 'RADIO':
      return (
        <fieldset>
          <legend className="block text-sm font-medium text-[var(--sw-secondary-700)] mb-1.5">
            {label}
            {field.isRequired && <span className="text-[var(--error)] ms-1">*</span>}
          </legend>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label key={opt} className="inline-flex items-center gap-2 text-sm text-[var(--sw-body)]">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={stringValue === opt}
                  onChange={() => onChange(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case 'CHECKBOX':
      return (
        <fieldset>
          <legend className="block text-sm font-medium text-[var(--sw-secondary-700)] mb-1.5">
            {label}
            {field.isRequired && <span className="text-[var(--error)] ms-1">*</span>}
          </legend>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label key={opt} className="inline-flex items-center gap-2 text-sm text-[var(--sw-body)]">
                <input
                  type="checkbox"
                  value={opt}
                  checked={arrayValue.includes(opt)}
                  onChange={() => onToggleCheckbox(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case 'TEXT':
    default:
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT}
          />
        </div>
      );
  }
}
