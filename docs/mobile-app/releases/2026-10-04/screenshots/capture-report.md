# App Store screenshot capture — 2026-10-04

Ten raw native PNG candidates are ready for parent visual review and owner approval. No upload or Apple changes were performed. Only the ten files named in SHA256SUMS are candidates; inspection images are not store assets.

## Runtime evidence

- Source: e4db299c66816eab810a9cc9d0cc8a19ea699a0a in /Users/tariq/code/sawaa; no source edits by this lane.
- API: https://api.sawaa.sa/api/v1, verified present in the served Metro bundle. Public catalog reads only; no sign-in, patient data, booking creation, payment, or other production write.
- Native development shell reused from existing simulator: sa.sawa.app, 1.0.0 (1), SDK iphonesimulator27.0. Current JavaScript fetched from localhost:8081; runtime log confirms .virtual-metro-entry.bundle load. This is current-source simulator evidence, not verification of the TestFlight binary.
- iPhone 17 Pro Max / iOS 26.5: dedicated simulator 13D96D68-CDCA-438F-8931-FD4D255DEBD4, native 1320×2868.
- iPad Pro 13-inch M5 / iOS 26.5: dedicated simulator F9C3CB10-7A7F-483A-AAB8-C766CC7A099D, native 2064×2752.
- Light appearance, status bar overridden to 9:41 / full battery / Wi-Fi. iPad keeps the real October 4 date. XcodeBuildMCP profile `sawaa-store-capture`.
- Capture uses xcrun simctl io screenshot because XcodeBuildMCP screenshot returns resized JPEG. Individual PNGs have not been resized, composited, retouched, or recompressed.
- capture-evidence.json records dimensions, file hashes, native executable hash, and served Metro bundle hash. All 10 SHA256SUMS entries verified OK.

## Route mapping and interaction

| Suffix | Screen | Route/state |
| --- | --- | --- |
| 01-home | Guest home | Fresh app launch; latest public home cards, practitioner and clinic catalog |
| 02-specialists | Specialist directory | Home → المختصون → /public-list/therapist |
| 03-profile | Specialist with selected service | /public-detail/therapist/c7606bd8-8450-44e4-bd2d-581c67fd6efa?serviceId=bde91fb9-b21d-4867-8d00-99fb6c841539&clinicId=e69c4e76-4fdb-48aa-903f-1a88bbcaac33 |
| 04-booking | Actual available date/time selector | Profile → احجز موعدًا → public-booking/bde91fb9-b21d-4867-8d00-99fb6c841539; 30-minute in-person SAR1200 option selected; October 5, 2026 at 4pm selected locally; 11 available times visible. Continue was not tapped. |
| 05-login | Empty login form | /login, no credentials entered and no OTP sent |

Practitioner is the public catalog entry أ. شيخة; service is قياس الذكاء "بينيه". The price and available times are actual API results, not synthetic fixtures. Deep links carry only public catalog identifiers and invoke normal app routes.

XcodeBuildMCP runtime snapshots were read before interactions. Some React Native service/option Pressables were absent from semantic tap targets. For these and the iPad dev-warning dismiss button, the bundled XcodeBuildMCP axe tool was used at coordinates verified from screenshots. No app internals/state were modified. The initial iPad accessibility snapshot failed during launch; one bounded retry succeeded after launch settled.

## Visual review and limitations

All ten final files were opened and inspected individually. Arabic is connected and legible, RTL positioning is consistent, expected screen content is loaded, and final files contain no error/dev banners or private data. The iPad developer warning toast was dismissed via its visible close button before the accepted home capture. iPhone uses bottom tabs; iPad uses native top tabs.

Truthful visible limitations: production practitioner entries have default avatar placeholders and several entries duplicate title/specialty wording. Directory lists and horizontal carousels naturally continue beyond the viewport. The profile is deliberately captured with a selected-service route and enabled booking CTA; the unscoped multi-service profile has text underneath its translucent fixed footer, visible in the separate inspection image. Tablet layouts spread over the full width and retain considerable blank space. These are current UI characteristics, not image processing artifacts.

Cold launch and normal warm navigation were exercised. AR→EN→AR language switching and real-device/TestFlight parity were not tested by this lane. No native build, build/lint/full suite, commit, push, upload, or App Review action was run.

## Measurement

Worker session 01a10661-d05b-7212-9eae-40d812f943f7; actual model/effort gpt-6-astra/high; policy astra-effort-v1. Baseline usage-baseline.json captured with snapshot.py --since 20261004. Parent reports receipt attachment is blocked by existing ledger KeyError participants. Whole-task attribution remains incomplete; inherited session counters are not attributable screenshot cost. Final response usage remains pending after checkpoint.

## Owner approval

Owner explicitly approved all ten images and requested upload on 2026-10-04. Original files and hashes are unchanged. Apple readback remains a parent-owned step.
