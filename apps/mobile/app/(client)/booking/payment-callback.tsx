import React, { useEffect } from 'react';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * The website callback only transports booking and invoice identity back into
 * the app. It never decides whether payment succeeded; checkout re-reads both
 * records from the authenticated API.
 */
export default function PaymentCallbackScreen() {
  const colors = useSawaaColors();
  const router = useRouter();
  const { bookingId, invoiceId } = useLocalSearchParams<{
    bookingId?: string;
    invoiceId?: string;
  }>();

  useEffect(() => {
    if (!bookingId) {
      router.replace('/(client)/(tabs)/appointments');
      return;
    }
    router.replace({
      pathname: '/(client)/booking/checkout',
      params: {
        bookingId,
        ...(invoiceId ? { invoiceId } : {}),
      },
    });
  }, [bookingId, invoiceId, router]);

  return (
    <AquaBackground>
      <View style={styles.container}>
        <ActivityIndicator color={colors.teal[600]} />
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
