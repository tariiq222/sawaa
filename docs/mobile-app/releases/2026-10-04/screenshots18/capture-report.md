# Build 18 screenshot recapture — 2026-10-04

Ten original native PNG screenshots reproduce the previously approved home, specialists, profile, booking and login scenes with build 18's restored wave background. The prior screenshots use a flat background and visually mismatch build 18; this complete replacement set is ready for coordinator review/upload. No Apple UI or account was changed by this lane.

## Source and runtime evidence

- Build 18 source manifest: base a25c3217e659768d953569acd7f89fef0ef65b19 plus the restored AquaBackground source and test. All 626 mobile/shared entries matched current file SHA-256 values, zero mismatches. `source-comparison.json` records the count and manifest hash. No mobile/shared edits were made by this lane.
- EAS build ddd30558-b50a-43db-8efb-8babeefdd838; Apple build 90c96a46-1034-43cd-b79b-680f57356049. Those identifiers associate the verified source manifest; screenshots were captured in a development simulator shell, not from installation of the physical-device IPA.
- Reused existing `sa.sawa.app` 1.0.0 (1) simulator shell built with SDK iphonesimulator27.0, running iOS 26.5. Cold-launch runtime logs confirm current JS fetched from localhost:8081. Served bundle contains https://api.sawaa.sa/api/v1 and both restored wave assets; bundle SHA-256 recorded in capture-evidence.json. Metro on 8093 was not touched.
- Dedicated iPhone 17 Pro Max: 13D96D68-CDCA-438F-8931-FD4D255DEBD4, 1320×2868. Dedicated iPad Pro 13-inch M5: F9C3CB10-7A7F-483A-AAB8-C766CC7A099D, 2064×2752.
- Both light appearance, status-bar override 9:41 and full battery/Wi-Fi; iPad retains actual October 4 date. XcodeBuildMCP `sawaa-store-capture` profile remains active on iPad at end.

## Scene mapping

| Suffix | Scene | Route/state |
| --- | --- | --- |
| 01-home | Guest home | Cold launch; current public home/catalog content |
| 02-specialists | Directory | Home → المختصون → public-list/therapist |
| 03-profile | Selected-service practitioner profile | public-detail/therapist/c7606bd8-8450-44e4-bd2d-581c67fd6efa, serviceId=bde91fb9-b21d-4867-8d00-99fb6c841539, clinicId=e69c4e76-4fdb-48aa-903f-1a88bbcaac33 |
| 04-booking | Available dates/times | Profile → احجز موعدًا; 30-minute in-person SAR1200 option; October 5, 2026 at 4pm locally selected, 11 available time choices. Continue not tapped. |
| 05-login | Empty login | /login; no identifiers, credentials, OTP, or review-login used |

The same public practitioner أ. شيخة and قياس الذكاء "بينيه" service as the approved set were used. Data is actual public production catalog/availability. No account access, booking creation, payment, or production write occurred.

## Capture and visual review

All ten final original PNGs were viewed individually. Checked connected Arabic text, RTL alignment, correct loaded scene, restored aqua wave appearance, expected native dimensions and absence of developer banners, dialogs, error states and private data. The iPhone warning toast was dismissed through its actual close control before capture. iPad cold launch was allowed to finish before its home capture.

XcodeBuildMCP handled launch/snapshots/semantic taps; its bundled axe coordinate tap handled the option cards absent from accessibility tap targets, using the current screenshot geometry. Native screenshots use `xcrun simctl io screenshot` because MCP's screenshot output is optimized JPEG. No original PNG was edited, resized, recompressed or composited. Copies in the stable directory are byte-identical.

`preview.png` is a genuine screenshot of `review.html` rendered in a fresh isolated headless Chromium process, showing the ten unchanged PNGs. It is for review only and is not one of the store assets. The browser closed after capture and did not connect to the coordinator's Apple browser.

Known truthful UI characteristics remain: default practitioner avatar placeholders, duplicated title/specialty on some public entries, lists/carousels continuing beyond the viewport, and full-width tablet layouts with blank space. The profile is scoped to a selected service and has an enabled booking button. Login back-control visibility can differ by navigation state; form content matches the approved scene.

All ten SHA256SUMS entries verified in the stable directory. Only those ten numbered files are upload candidates. Physical TestFlight behavior and AR→EN→AR switching are not verified here; no source tests/builds, commits, pushes or Apple operations were run by this lane.

## Measurement

Policy astra-effort-v1; reused worker session 01a10661-d05b-7212-9eae-40d812f943f7, actual gpt-6-astra/high. Baseline and checkpoint are retained only in the temporary screenshots18 directory with fixed window 20261004. Prior receipt attachment had failed with ledger KeyError participants; whole-task attribution remains incomplete. Upstream session totals include inherited/reused history and are not a claim of screenshot-specific consumption.
