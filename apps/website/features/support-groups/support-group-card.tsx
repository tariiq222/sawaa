import type { SupportGroup } from './support-groups.api';
import { halalasToSarNumber } from '@/lib/money';

interface SupportGroupCardProps {
  group: SupportGroup;
  onSelect?: (group: SupportGroup) => void;
  isSelected?: boolean;
}

export function SupportGroupCard({ group, onSelect, isSelected }: SupportGroupCardProps) {
  // `group.price` is integer halalas; convert to SAR before formatting.
  const formatPrice = (halalas: number, currency: string) => {
    if (halalas === 0) return 'مجاني';
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency,
    }).format(halalasToSarNumber(halalas));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-all ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
      }`}
      onClick={() => onSelect?.(group)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(group)}
    >
      {isSelected && (
        <div className="absolute -top-2 -end-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{group.title}</h3>
        {group.descriptionAr && (
          <p className="mt-1 text-sm text-muted-foreground">{group.descriptionAr}</p>
        )}
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(group.scheduledAt ?? '')}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {group.daysCount} days · {group.hoursPerDay}h / day
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{formatPrice(Number(group.price), group.currency)}</span>
        {group.isFull ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Full
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            {group.spotsLeft} spots left
          </span>
        )}
      </div>
    </div>
  );
}