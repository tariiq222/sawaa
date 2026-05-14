'use client';

import type { Service } from '@deqah/shared';
import { halalasToSarNumber } from '@/lib/money';

interface ServicePickerProps {
  services: Service[];
  selected: Service | null;
  onSelect: (service: Service) => void;
}

export function ServicePicker({ services, selected, onSelect }: ServicePickerProps) {
  return (
    <div className="grid gap-4">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select Service</h2>
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onSelect(service)}
          style={{
            padding: '1rem',
            border: selected?.id === service.id
              ? '2px solid var(--primary)'
              : '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            borderRadius: 'var(--radius)',
            background: selected?.id === service.id
              ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
              : 'transparent',
            textAlign: 'start',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 500 }}>{service.nameAr}</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>{service.nameEn}</div>
          <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
            {Intl.NumberFormat('ar-SA', { style: 'decimal' }).format(halalasToSarNumber(service.price))} {'⃁'}
          </div>
        </button>
      ))}
    </div>
  );
}