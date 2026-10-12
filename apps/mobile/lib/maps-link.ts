import { Linking, Platform } from 'react-native';

/** Opens the platform maps app at a point; falls back to Google Maps on the web when no maps scheme is handled. */
export async function openInMaps(latitude: number, longitude: number): Promise<void> {
  const target = Platform.OS === 'ios'
    ? `maps:?q=${latitude},${longitude}`
    : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
  const supported = await Linking.canOpenURL(target);
  await Linking.openURL(supported ? target : `https://maps.google.com/?q=${latitude},${longitude}`);
}
