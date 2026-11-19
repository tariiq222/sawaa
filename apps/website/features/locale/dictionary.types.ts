/**
 * A dictionary feature group.
 *
 * `en` is typed as `Record<keyof T, string>` where `T` is the `as const`
 * Arabic map, so a missing or misspelled English key is a TypeScript error.
 * Extra English keys are rejected too: object literals assigned to a
 * `Record<keyof T, string>` are checked exhaustively.
 */
export type LocalizedDictionary<T extends Record<string, string>> = {
  ar: T;
  en: Record<keyof T, string>;
};
