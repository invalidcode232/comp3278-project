/** Form input helpers shared by the Server Actions. */

export const HANDLE_RE = /^[A-Za-z0-9_]{3,30}$/;

/** Maximum text-body length in UTF-16 code units after trimming. */
export const MAX_BODY = 5000;

/** Expected Server Action feedback; undefined represents a form with no result yet. */
export type FormState =
  | {
      /** Expected user-facing failure text; omitted on success. */
      error?: string;

      /** User-facing success text; omitted on failure. */
      ok?: string;
    }
  | undefined;

/** Expected user-input failure that may be displayed in a form without exposing internal errors. */
export class InputError extends Error {}

/** Trimmed string, or "" if missing.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 * @param key Form field name to read.
 */
export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Trimmed text, or null when empty (so the body-or-image CHECK sees NULL, not "").
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 * @param key Form field name to read.
 * @param max Maximum permitted UTF-16 code-unit count after trimming.
 */
export function optionalText(
  formData: FormData,
  key: string,
  max = MAX_BODY,
): string | null {
  const v = str(formData, key);
  if (v.length > max)
    throw new InputError(`Text must be at most ${max} characters.`);
  return v === "" ? null : v;
}

/** A positive integer id from the form or URL, or throws.
 * @param value Untrusted submitted identifier to validate as a positive safe integer.
 */
export function id(
  value: FormDataEntryValue | string | null | undefined,
): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new InputError("Invalid id.");
  return n;
}

/** Positive integer from a route param, or null (pages call notFound()).
 * @param value Untrusted submitted identifier to validate as a positive safe integer.
 */
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Return user-facing text only for InputError; unexpected failures remain unhandled by this helper.
 * @param err Caught failure; only expected input/constraint errors become user-facing feedback.
 */
export function errorMessage(err: unknown): string | null {
  return err instanceof InputError ? err.message : null;
}
