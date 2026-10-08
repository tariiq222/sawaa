# Employee image repair plan

Spec: this document. Scope: local repair only; no commit, push, production writes or deployment.

## Contract
Employee internal avatar and public profile image stay separate. Uploads remain PRIVATE. A dedicated public-image upload explicitly publishes that image via short-lived signed reads. Read handlers may sign only registered image files owned by the same employee. Legacy external URLs remain supported; unresolved bare legacy filenames remain null, with no automatic production migration. Dashboard reads round-trip all public profile fields. Never persist browser blob previews or expiring signed URLs from edit forms.

## Task 1: Backend employee images
Interfaces: UploadAvatarCommand adds optional target public; avatar remains default. Dedicated POST employees/:employeeId/public-image uses existing update Employee permission and multipart validation. Store stable storageKey; return signed URL. OwnedImageResolver (published by MediaModule) resolves employee-owned image files from key/full URL, rejecting unknown managed keys. Inject into admin/public read handlers and preserve mapper public fields.
Tests: resolver ownership/mime/legacy/null cases, upload defaults/public isolation, mapper round-trip and public handler reads. First observe focused RED, then GREEN. Synchronize OpenAPI and generated dashboard types after endpoint change.

## Task 2: Dashboard uploads
Depends on Task 1 route and signed read contract. Replace public URL field with AvatarUpload, defer selected file upload until Save; preserve image when text changes; explicit clear sends null. Disable Save during both mutations, show upload error. Basic employee create/edit omits avatar URL previews and signed read URLs; upload handler is sole file persistence path.
Tests: public upload selection/save/clear/failure and form payload regression; focused RED then GREEN.

## Task 3: Verification and operations handoff
Run focused suites, affected typechecks, OpenAPI sync, dashboard smoke using isolated local services and exercise upload/read flow locally. Fresh whole-diff review. Document evidence and any unverified live flows. Receipt delegate reproduces PDF glyph error with synthetic data and applies a fresh-font render gate only; verify real ESM sequential/concurrent rendering, release after errors, and text/all-page pixel parity against fresh original processes. No financial logic change. Operational settings and legacy image migration require concrete separate proposals; no production mutation in this worktree.

## Review Focus
No private invoice/file signing through employee fields; public/internal images remain distinct; no signature persisted; list/detail agree; upload failure preserves existing image; cache lifetime shorter than signed URL; no credentials or production data in artifacts.
