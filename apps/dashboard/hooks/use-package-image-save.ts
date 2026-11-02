"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { attachPackageImage, deletePackageMedia, uploadPackageMedia } from "@/lib/api/packages"
import type { PackageMediaUpload } from "@/lib/api/packages"

type Translate = (key: string) => string

export type PackageImageSaveResult =
  | { ok: true; storageKey: string }
  | { ok: false; message: string }

/**
 * Shared save + image flow for both package forms (legacy and GROUPED_V2).
 *
 * Order (audit T11-F1): the package is written first without the image blob,
 * then the image is uploaded and its stable storage key is attached with an
 * image-only PATCH. Callers run their toast + navigation only after this
 * resolves `ok: true`, so a failed image can never look like a saved package.
 *
 * Failure (audit T11-F2): an image-stage error message is returned (never
 * swallowed) and the working copy is kept by the caller for a retry, and the
 * localized error is shown here (a hard error toast — never a soft warning).
 * If the attach PATCH fails, the uploaded media record is orphaned with no
 * package pointing at it, so a best-effort delete of that media record is
 * attempted. Cleanup can never mask the attach failure, which stays the
 * visible error. A save-stage failure is rethrown to the owning form (t10) so
 * its translation map and step recovery apply.
 *
 * Leaving the screen (t15): the upload/attach request itself is never aborted —
 * cancelling a mutation mid-upload would orphan media with no package pointing
 * at it. Only presentation is guarded: after unmount a late response shows no
 * toast, calls no `finish` (success toast + navigation), and touches no state.
 * `canNavigate` extends that guard to the caller's own fallback navigation, so
 * a form that was left is never pushed to another screen.
 */
export function usePackageImageSave(t: Translate) {
  const [failedUpload, setFailedUpload] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * The key is the default; the server's validation text is used only when it
   * is already a translation key, so raw English API messages never leak.
   */
  const errorMessage = (err: unknown, stage: "upload" | "attach") => {
    const key = stage === "upload" ? "packages.errors.imageUpload" : "packages.errors.imageAttach"
    const serverMessage = err instanceof ApiError ? err.message : ""
    return serverMessage.startsWith("packages.") ? t(serverMessage) : t(key)
  }

  const attach = async (
    packageId: string,
    file: File,
  ): Promise<PackageImageSaveResult> => {
    setFailedUpload(null)
    let uploaded: PackageMediaUpload
    try {
      uploaded = await uploadPackageMedia(file)
    } catch (err) {
      const message = errorMessage(err, "upload")
      // Late response after the screen was left (t15): no toast, no state.
      if (!mounted.current) return { ok: false, message }
      setFailedUpload(`${file.name} — ${message}`)
      toast.error(message)
      return { ok: false, message }
    }
    try {
      await attachPackageImage(packageId, uploaded.storageKey)
      return { ok: true, storageKey: uploaded.storageKey }
    } catch (err) {
      const message = errorMessage(err, "attach")
      try {
        await deletePackageMedia(uploaded.id)
      } catch {
        // cleanup is best effort only
      }
      if (!mounted.current) return { ok: false, message }
      setFailedUpload(`${file.name} — ${message}`)
      toast.error(message)
      return { ok: false, message }
    }
  }

  /**
   * `save` persists every non-image field and returns the package id; `finish`
   * — toast + navigation — runs only when the image step (if any) succeeded.
   * Returns whether the whole flow succeeded so the caller can stay on the form.
   *
   * A save failure is intentionally rethrown to the owning form (audit t10):
   * the forms own the package error translation map and the step the user must
   * return to, so catching it here would show the raw 4xx message instead.
   */
  const saveWithImage = async (opts: {
    save: () => Promise<string>
    finish: () => void
    file: File | null
  }): Promise<boolean> => {
    const packageId = await opts.save()
    if (opts.file) {
      const result = await attach(packageId, opts.file)
      if (!result.ok) return false
    }
    // A late success after the screen was left (t15) must not navigate there.
    if (!mounted.current) return true
    opts.finish()
    return true
  }

  /**
   * Departure guard for the caller's own navigation (t15). The forms' failed
   * image step falls back to the created package's edit screen, and that push
   * lives in the form component — not here — so the component must ask whether
   * it is still mounted before navigating. Returned as a function (never a raw
   * ref) because `react-hooks/refs` forbids reading a ref during render, and a
   * form's submit callback runs in that scope.
   */
  return { failedUpload, saveWithImage, canNavigate: () => mounted.current }
}
