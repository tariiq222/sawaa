import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TherapistProfileView } from '@/components/features/directory/TherapistProfileView';
import { usePublicCatalog, useTherapist } from '@/hooks/queries';
import { AquaBackground } from '@/theme/sawaa';

export default function EmployeeProfileScreen() {
  const { id, clinicId, serviceId, steps } = useLocalSearchParams<{ id: string; clinicId?: string; serviceId?: string; steps?: string }>();
  const router = useRouter();
  const { data: employee, isLoading: employeeLoading, isError: employeeError, refetch: refetchEmployee } = useTherapist(id);
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } = usePublicCatalog();

  const book = (selectedServiceId: string, employeeId: string) => {
    const selectedService = catalog?.services.find((service) => service.id === selectedServiceId);
    const selectedClinic = catalog?.categories.find((category) =>
      category.id === selectedService?.categoryId &&
      (category.kind ?? 'CLINIC') === 'CLINIC' && category.isActive !== false && category.archivedAt == null,
    );
    const bookingClinicId = clinicId ?? selectedClinic?.id;
    router.push({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: selectedServiceId, employeeId, ...(bookingClinicId ? { clinicId: bookingClinicId } : {}), ...(steps ? { steps } : {}) },
    });
  };

  return (
    <AquaBackground>
      <TherapistProfileView
        employee={employee}
        loading={employeeLoading}
        catalog={catalog}
        catalogLoading={catalogLoading}
        employeeError={employeeError}
        catalogError={catalogError}
        onRetryEmployee={() => void refetchEmployee()}
        onRetryCatalog={() => void refetchCatalog()}
        clinicId={clinicId}
        serviceId={serviceId}
        onBack={() => router.back()}
        onBook={book}
      />
    </AquaBackground>
  );
}
