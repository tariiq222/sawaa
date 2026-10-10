interface SaveSteps<T> {
  create: () => Promise<T>
  resume?: (record: T) => Promise<unknown>
  complete: (record: T) => Promise<unknown>
}

/** A mounted draft retains its server record if a later step fails. */
export function createResumableSave<T>() {
  let record: T | undefined
  let inFlight: Promise<T> | null = null
  return {
    run(steps: SaveSteps<T>): Promise<T> {
      if (inFlight) return inFlight
      inFlight = Promise.resolve().then(async () => {
        if (record === undefined) record = await steps.create()
        else await steps.resume?.(record)
        await steps.complete(record)
        return record
      }).finally(() => { inFlight = null })
      return inFlight
    },
  }
}
