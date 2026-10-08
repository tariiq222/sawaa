import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TherapistProfileView } from '@/components/features/directory/TherapistProfileView';
import { usePublicCatalog, useTherapist } from '@/hooks/queries';
import { goBackOrHome } from '@/lib/navigation';
import { AquaBackground } from '@/theme/sawaa';

export default function EmployeeProfileScreen() {
  const { id, clinicId, serviceId, steps } = useLocalSearchParams<{ id: string; clinicId?: string; serviceId?: string; steps?: string }>();
  const router = useRouter();
  const employeeQuery = useTherapist(id);
  const { data: employee, isLoading: employeeLoading } = employeeQuery;
  const catalogQuery = usePublicCatalog();
  const { data: catalog, isLoading: catalogLoading } = catalogQuery;

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
        employeeError={employeeQuery.isError}
        onRetryEmployee={() => { void employeeQuery.refetch(); }}
        catalogError={catalogQuery.isError}
        onRetryCatalog={() => { void catalogQuery.refetch(); }}
        catalog={catalog}
        catalogLoading={catalogLoading}
        clinicId={clinicId}
        serviceId={serviceId}
        onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')}
        onBook={book}
      />
    </AquaBackground>
  );
}
