# TestFlight preflight — 2026-09-24

Status (updated after Expo login): Expo project/environment configured. Waiting for owner Apple Developer authentication/signing and encryption declaration. No IPA built, no TestFlight upload, no public release, no commit/push.

Source: develop at 7268ecdc2cd56020607a54e88efd5a3ca415014c plus the local test-isolation change in apps/mobile/app.config.test.ts. The test now disables Expo dotenv loading so missing-API assertions cannot consume developer .env values. Production validation is unchanged.

## Fresh evidence

- Full mobile Jest: 52 suites, 282 passed, 0 failed/skipped after isolation fix. Final type-only annotation subsequently checked with the config suite: 2 passed.
- Mobile typecheck: passed after explicitly typing the child-process environment as NodeJS.ProcessEnv.
- Changed test ESLint and git diff --check: passed.
- iOS Expo export: passed with explicit EXPO_PUBLIC_API_URL=https://api.sawaa.sa/api/v1 and EAS_BUILD_PROFILE=production. This is a JS/Hermes export, not a signed archive or live API acceptance.
- EAS CLI whoami: exited 1, Not logged in. No EXPO_TOKEN present. No extra.eas.projectId in committed config; remote project/history not verified.
- Keychain: one valid Apple Development identity, no distribution identity returned. This does not establish whether remote Apple/EAS distribution credentials exist.
- Xcode 27.0 (27A266a) installed.
- Local Firebase iOS plist exists and its BUNDLE_ID matches sa.sawa.app. Remote EAS file variable/APNs provider configuration not verified.
- Existing ignored ios project predates RNFirebase integration: no RNFB/Firebase pods or FirebaseApp.configure, no static-framework property. Regenerate in an isolated build environment; do not use this stale project as current release evidence.

Logs and independent read-only native review: /tmp/sawaa-testflight-20260924/. These are local temporary evidence, not remotely retained release artifacts.

## Resume

1. Owner identifies Expo account/organization and authenticates locally with `npx --yes eas-cli@latest login` from apps/mobile. Do not send passwords in chat.
2. Read EAS project/build history and Apple app/team record. Select existing intended project before creating anything. Confirm production API, Firebase file variable, build number and distribution credentials.
3. Perform a clean native production build for TestFlight, verify artifact metadata/effective entitlements and upload to the confirmed App Store Connect app. Do not submit for public App Review automatically.
4. Owner/device acceptance: iPhone and iPad login/OTP, booking, payment and callback, push delivery/tap, deletion and policy/store metadata. Moyasar sandbox remains unverified.

## Measurement

Policy astra-effort-v1; task class release, complexity medium. Coordinator and one read-only reviewer used gpt-6-astra medium. Receipt sawa-testflight-20260924 has partial baselines; whole-task consumption remains unknown. No quota retries or paid API fallback. TestFlight objective is not accepted because authentication/build/upload gates remain open.


## Resumed after Expo login

- Authenticated Expo account tariq222; inspected both accounts. Personal account had zero projects; tariq222-org had only zid.app. Created https://expo.dev/accounts/tariq222/projects/sawa with ID f6349cef-8426-442c-b249-118a9b512cf1 and linked app.config.ts. project:init created the remote project but could not edit dynamic config; local linkage was applied explicitly.
- Created project-scoped production EXPO_PUBLIC_API_URL=https://api.sawaa.sa/api/v1 (plaintext) and FIREBASE_IOS_GOOGLE_SERVICES_FILE (secret file). No provider private keys were copied or changed.
- Configured cli.appVersionSource=remote in eas.json for remote build numbering.
- EAS noninteractive build stopped at missing distribution credentials before any build submission. Interactive build remains pending the owner's encryption declaration. Apple credentials setup reached the password prompt; cancelled that agent-terminal process and opened a dedicated Terminal command for the owner. Do not collect password/2FA in chat.
- EAS archive inspection excluded local .env files and old native iOS project; ignored private-config and shared/dist directories were empty. No private-config files were present in the inspected archive.
- Fresh archive pnpm frozen install succeeded but require('@sawaa/shared/money') failed MODULE_NOT_FOUND because dist is not tracked. Added mobile postinstall: pnpm --filter @sawaa/shared build. Re-ran frozen install in isolated archive: shared compilation passed, then shared/money resolved.
- Clean iOS prebuild --no-install passed in the isolated archive with current config and local Firebase plist. Generated AppDelegate contains FirebaseApp.configure() and Podfile.properties.json uses static frameworks. CocoaPods/native compilation/signing/device execution remain unverified.
- Build lifecycle reference: https://docs.expo.dev/build-reference/build-with-monorepos/ and https://docs.expo.dev/build-reference/ios-builds/.
- Scope: app.config.ts, eas.json, package.json, prior app.config.test.ts fix and this report. No root workspace or application behavior changes.
- Resume receipt sawa-testflight-resume-20260924: astra-effort-v1, gpt-6-astra medium, partial baseline; account/build setup phase remains incomplete. Final response counters pending; total accepted-task consumption unknown.
- Final resumed verification: mobile Jest 52 suites/282 tests passed, 0 failed/skipped; mobile typecheck passed; app.config.ts/app.config.test.ts ESLint passed; git diff --check passed.

## Browser account and app record (2026-09-24)

- Chrome's existing Apple session is webvue2@gmail.com, Tariq Alshehri, team 569M49FYA6, active individual membership renewing 2027-09-11. This is distinct from the earlier locally suggested Apple ID; browser session verified the intended existing Sawaa bundle sa.sawa.app with Push Notifications enabled.
- App Store Connect initially showed No Apps; created the iOS record with user-approved exact name `سواء للارشاد الاسري | sawaa`, primary Arabic, SKU sa.sawa.app. Verified after refresh and in its detail page: https://appstoreconnect.apple.com/apps/6815632181/distribution (Prepare for Submission). No public submission/release.
- Updated local Expo display name to match; ios.appleTeamId and EAS submit appleTeamId = 569M49FYA6; ascAppId = 6815632181. Typecheck and app.config.test.ts (2 tests) passed; diff check passed.
- Apple certificates list was empty. Prepared a protected, Git-ignored local distribution key/CSR and attached CSR to Apple Distribution form. CSR verifies. Stopped BEFORE Continue creates the certificate, pending browser-policy confirmation for new signing access and EAS custody. No new Apple certificate or profile has been issued by this workflow yet. No private key contents logged.
- Encryption declaration still awaits owner response. No signed build or TestFlight upload exists.
- Browser/name continuation has no complete usage baseline; consumption attribution remains unknown. Earlier receipt evidence may predate these appended updates and must not be treated as a frozen whole-task receipt.

## Continued release preparation: native failure and branding repair

- Apple Distribution certificate and App Store provisioning profile created with explicit owner approval and uploaded to EAS. Team `569M49FYA6`, bundle `sa.sawa.app`, App Store Connect app `6815632181`.
- First EAS signed build `63ecfba9-d274-4bad-b174-8c0f9e4cd9f0` failed at the Sentry debug-symbol script: `Cannot find module '@sentry/cli/package.json'`. Native compilation reached this build phase; no installable artifact from this build.
- Added exact `@sentry/cli@2.58.4` development dependency (matching the React Native SDK dependency). Frozen isolated install and module resolution from isolated ios directory now pass. Sentry runtime collection has not been disabled.
- Replaced default Expo icon and default splash construction grid with the existing website Sawa icon, preserving the original brand asset. An image-generation candidate was reviewed but not selected because it altered the emblem. Expo prebuild produces a visually checked 1024x1024 opaque iOS icon from the original asset; no alpha channel remains in generated native icon.
- Focused config tests: 2 passed; mobile TypeScript passed; git diff whitespace check passed. Earlier full mobile suite remains 282 passed.
- Browser transport began timing out; Chrome is running and native host manifest checks correctly, extension profile diagnostic is denied by macOS EPERM. Owner asked to reconnect the Chrome extension; no unsupported browser automation fallback used.
- Native screenshots can now be captured without developer banner using existing debug shell with production JS settings and isolated synthetic HTTPS fixture. Device screenshots are not proof of signed release archive execution.
- App Store page form changes were previously entered, but Save/upload/TestFlight invitation are not yet verified. No public App Review submission.
- Task measurement remains partial under `astra-effort-v1`; no complete accepted cost claim.

- Replacement EAS build: `7fdc7458-8d6d-4e18-b2e1-69a4c330d2b5`, version 1.0.0 build 2, production STORE. Fresh logs show native compilation in RUN_FASTLANE. Not yet accepted/completed.
- Fresh public URL checks: support `/contact`, privacy `/privacy`, and API `/api/v1/health` each return HTTP 200; this is availability evidence only.
- Reviewer measurement attachment to the current receipt was refused because its old task lacked a postfinish checkpoint. Retained unknown attribution instead of manufacturing a baseline boundary.

## Second native-build failure and optional telemetry upload

Build `7fdc7458-8d6d-4e18-b2e1-69a4c330d2b5` reached Sentry source-map upload and failed because `SENTRY_AUTH_TOKEN` is absent. Added `SENTRY_ALLOW_FAILURE=true` to the EAS production build environment following the Sentry CLI's own failure message. The SDK/runtime error collection is unchanged; source maps/debug-symbol uploads may remain unavailable until build-service authentication is configured. This limitation must remain visible in release handoff. Third signed build submitted; completion still pending.

- Third EAS build ID `41611b2c-9256-47d4-834b-7e577dfa66fb`, version 1.0.0 build 3.
- Non-interactive EAS Submit attempted against that build to validate upload readiness. It failed before submission: no complete App Store Connect credentials; API keys cannot be set up non-interactively. No TestFlight upload or invitation occurred.
- Requested explicit approval for a new Developer-role App Store Connect API key with local/EAS custody, explaining that team-level access may cover other apps. Pending owner response and Chrome reconnection; prior certificate approval was not reused as API-key approval.

## Verified signed build and screenshot package

- EAS `41611b2c-9256-47d4-834b-7e577dfa66fb`: FINISHED; ARCHIVE SUCCEEDED; iPhoneOS version 1.0.0 (3).
- Official `eas build:download` succeeded (23.5 MB) after anonymous download returned 403. Extracted .app verified with `codesign --verify --deep --strict` (exit 0).
- Info.plist exact approved display name and sa.sawa.app/build 3. Embedded provisioning team 569M49FYA6; get-task-allow=false; aps-environment=production.
- Hermes bundle includes production API URL; no temporary screenshot tunnel or 127.0.0.1:5200. Screenshot fixture is separate from release configuration.
- AppIcon files exist in archive. Optimized archive PNG is unsupported by image viewer; generated prebuild 1024 icon was independently viewed and verified opaque earlier.
- Ten original native screenshots prepared: five iPhone 1320x2868, five iPad 2064x2752. Parent independently inspected final iPhone specialist profile and iPad booking options without banners/dialogs. Synthetic 100 SAR price is demo data, not verified live pricing.
- Files: /tmp/sawaa-store-assets-20260924/screenshots/store-ready; manifest hashes and source report alongside. Owner review/upload pending.
- NOT COMPLETED: App Store screenshot upload/metadata Save, export-compliance declaration, TestFlight submission/processing/invitation. Browser reconnection and new API-key approval pending. User cannot yet install via TestFlight.
- Sentry runtime code unchanged; report delivery unverified, source-map upload allowed to fail without build-service token.

## Owner correction: IBM Arabic and RTL (supersedes screenshots/build 3)

Owner rejected the previous screenshots: wrong typeface and reversed Arabic alignment. Do not upload the old screenshot set or treat build 3 as the corrected UI release.

Root causes verified from current source and installed React Native Fabric implementation:
- fonts.ts deliberately resolved body to system font and headings to Handicrafts, while RootLayout never loaded its fontAssets.
- AquaBackground inherited native RTL while useDir also applied row-reverse. Fabric additionally swaps explicit left/right text alignment under RTL Yoga layout direction.

Correction uses a stable LTR layout basis for native/web, with locale-driven row order, text alignment and writing direction. Removed language-based global forceRTL mutations; startup clears legacy forced RTL. IBM Plex Sans Arabic weights 300/400/500/600/700 are locally bundled through @expo-google-fonts and RootLayout waits for expo-font before hiding splash/showing content. Shared text/input/button defaults use IBM.

Meaningful regressions first failed on original source; fixed suite now 54 suites / 291 tests passed, TypeScript passed, scoped ESLint passed. Includes both native RTL states, iOS/Android/web direction cases and AR→EN→AR text rerender. Native runtime recapture/font-loaded verification still pending at this entry.

Native review's missing direct imports fixed by SDK55-compatible expo-font ~55.0.8 and expo-splash-screen ~55.0.25. Its web direction finding fixed by using explicit mirroring on every platform, covered in the platform matrix. Full native build will be replaced after screenshot verification. All changes uncommitted.

### IBM/RTL runtime and final source verification

- Native iPhone/iPad inspector confirms IBM 400 and 700 loaded; heading alias IBM700. Cold cached nativeRTL=true and warm nativeRTL=false both produce right-aligned Arabic content on the explicit LTR layout basis.
- AR→EN→AR runtime switch verified. Arabic native tabs now home at right, English home at left; labelStyle uses IBM500. Home remains selected after restart.
- Fixed short/overflowing horizontal carousel start in home, specialist filters and booking dates with LocalizedHorizontalScroll; standalone back controls use locale logical start. Read-only follow-up found settings/video join hardcoded rows; corrected layout styles and settings input typography without changing business flows.
- Final TypeScript exit0; Jest 54 suites / 291 tests pass; scoped ESLint 38 source/test files: 0 errors, 2 existing unused f600 warnings in payment/bank-transfer; git diff --check passed.
- New signed iOS build4 requested; native completion not yet verified. Final screenshot recapture underway after source freeze. Old store-ready screenshots and signed build3 remain superseded.
- Measurement policy astra-effort-v1; current bugfix receipt partial because coordinator/worker baselines late and reviewer old interval could not be safely closed. No whole-task token claim.

- Final10 recaptured with frozen source; parent independently viewed home/profile/iPad filters. Arabic home tab right, back controls right, short filter/card rows right. English home tab left and switching back Arabic verified. Artifacts copied unchanged to the task visualization folder, zipped for review. Worker stopped temporary Metro, fixture and Cloudflare tunnel.
- Replacement signed build4: ac247496-a84f-43aa-84dd-4f1b8d208caa. Browser reconnection attempt still timed out; no Apple draft/save/upload changes in this correction turn.

## Supervised Luna store launch continuation

- Owner explicitly requested Luna browser execution supervised until app launch; this now authorizes app submission/release after verified requirements, superseding earlier no-public-submission scope. It does not authorize unrelated backend production deployments, security-sensitive access grants or legal agreements without required confirmation.
- Worker model requested gpt-6-luna medium, isolated browser responsibility; parent Astra medium owns EAS validation. Receipt sawa-launch-20260924 remains partial (planning precedes baseline; prior task deletion interval not independently attributable).
- Fresh EAS build4 status FINISHED, completed 2026-09-24T12:46:12.636Z. Official CLI download, codesign --verify --deep --strict exit0. sa.sawa.app, approved Arabic/English display name,1.0.0(4),team569M49FYA6,debugfalse. ProductionAPI present; fixtureURL absent. All five IBMttf hashes match installed source. /tmp/sawaa-testflight-20260924/build4-verification.json.
- Owner supplied reviewcontact privately for authorized Apple entry; no existing dedicated reviewaccount. Mobile customer sign-in currently phone/verifiedemail OTP only. Development OTP bypass is explicitly prohibited in production; no auth changes made.

### Browser draft progress and final-release content correction

Luna reports saved Arabic listing/support/marketing/reviewcontact and privacy-policy URL; uploaded five native IBM/RTL images per iPhone6.9/iPad13 and sorted home→specialists→profile→booking→login. API access not enabled: RequestAccess available, approval requested from owner. Owner responses pending for scoped reviewaccount/auth change and proposed copyright/category/Saudiavailability. No API request, key creation, final privacy declaration or public submission yet.

During source verification for the age-rating questionnaire, found an unconditional fabricated treatment note on every client appointment ('progressive relaxation'/'thought log'). Removed that section rather than presenting it as clinician-authored. Removed fabricated Sara fallback from home when firstName absent; greeting now omits nonexistent name. No auth or payment logic changes. Fresh mobile TypeScript/scopedESLint passed; 54suites/291tests passed. Newbuild5 e017e116-6d82-477b-870e-b4fc3cfdb566 submitted; build4 now superseded for finalrelease. Existing ten screenshots unaffected (real synthetic fixture name present, appointmentdetails not included).

Read-only public productionAPI content: 26 professionals, two addiction-treatment specialty titles; biosnull; clinicalassessment service names. No private patientdata accessed. AccountIndividual vs Apple's guideline5.1.1(ix) legalentity healthcare guidance reported toowner as reviewrisk, not actualASCblock/guaranteedrejection. PaidAppsAgreement not signed; FreeAppsAgreementActive perUI. DSA conditional onEUavailability, which isnotyetselected.

- Parent visually verified saved ASC screenshot proof: 5 per device, correct order. Build5 FINISHED at 2026-09-24T13:23:47Z; downloaded official artifact, strict signature passed, bundle/name/version5 correct, productionAPI present, fixtureURL/fabricated treatment text absent, all five required IBM300–700 hashes match. Initial verification glob mistakenly included unused100/200 weights; corrected scope confirms required assets. Evidence: /tmp/sawaa-testflight-20260924/build5-verification.json. No Apple upload yet; owner API consent/review-account/store-choice answers remain pending.
