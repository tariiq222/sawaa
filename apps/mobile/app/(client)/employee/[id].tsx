import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TherapistProfileView } from '@/components/features/directory/TherapistProfileView';
import { usePublicCatalog, useTherapist } from '@/hooks/queries';
import { AquaBackground } from '@/theme/sawaa';

export default function EmployeeProfileScreen() {
  const { id, clinicId, serviceId } = useLocalSearchParams<{ id: string; clinicId?: string; serviceId?: string }>();
  const router = useRouter();
  const { data: employee, isLoading: employeeLoading } = useTherapist(id);
  const { data: catalog, isLoading: catalogLoading } = usePublicCatalog();

  const book = (selectedServiceId: string, employeeId: string) => {
    const selectedService = catalog?.services.find((service) => service.id === selectedServiceId);
    const selectedClinic = catalog?.categories.find((category) =>
      category.id === selectedService?.categoryId &&
      (category.kind ?? 'CLINIC') === 'CLINIC' && category.isActive !== false && category.archivedAt == null,
    );
    const bookingClinicId = clinicId ?? selectedClinic?.id;
    router.push({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: selectedServiceId, employeeId, ...(bookingClinicId ? { clinicId: bookingClinicId } : {}) },
    });
  };

  return (
    <AquaBackground>
      <TherapistProfileView
        employee={employee}
        loading={employeeLoading}
        catalog={catalog}
        catalogLoading={catalogLoading}
        clinicId={clinicId}
        serviceId={serviceId}
        onBack={() => router.back()}
        onBook={book}
      />
    </AquaBackground>
  );
}
