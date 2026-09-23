# Native Firebase push setup

The backend sends directly through Firebase Admin, so mobile registers only
Firebase Cloud Messaging (FCM) registration tokens. Expo push tokens and raw
APNs device tokens cannot be used with this sender.

1. In the Firebase project used by the backend sender, register iOS and Android
   apps with bundle ID/package `sa.sawa.app`. Download the iOS
   `GoogleService-Info.plist` and Android `google-services.json` client files.
   Keep these files out of git.
2. Set `FIREBASE_IOS_GOOGLE_SERVICES_FILE` and
   `FIREBASE_ANDROID_GOOGLE_SERVICES_FILE` to the corresponding paths in the
   build environment. `app.config.ts` supplies them to Expo's
   `googleServicesFile` fields. Make the files available to EAS builds through
   the build environment or local build setup; paths alone do not upload them.
3. Configure the Firebase iOS app for Cloud Messaging with an APNs key or
   certificate and enable the push notifications capability in Apple signing.
   Verify the built app has an appropriate `aps-environment` entitlement.
4. Build a new development or release binary after adding the native packages.
   Expo Go and old development binaries cannot load React Native Firebase.
   Use a physical device to verify iOS APNs registration and FCM delivery.

`expo-notifications` handles permission requests and foreground display.
`@react-native-firebase/messaging` supplies the FCM token on both platforms.
The authenticated hook subscribes to `subscribeToFcmTokenRefresh` from
`services/push.ts`, registers refreshed tokens with the backend, and disposes
the subscription when the session ends. Token acquisition returns `null` when
permissions are denied, native messaging is unavailable, or Firebase fails.

No Firebase client configuration files are present in the repository. Native
prebuild, signing, and provider delivery remain device/build verification gates
until real files and credentials are supplied.
