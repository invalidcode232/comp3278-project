/** Form input helpers shared by the Server Actions. */

export const HANDLE_RE = /^[A-Za-z0-9_]{3,30}$/;
export const MAX_BODY = 5000;

export type FormState = { error?: string; ok?: string } | undefined;

export class InputError extends Error {}

/** Trimmed string, or "" if missing. */
export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Trimmed text, or null when empty (so the body-or-image CHECK sees NULL, not ""). */
export function optionalText(formData: FormData, key: string, max = MAX_BODY): string | null {
  const v = str(formData, key);
  if (v.length > max) throw new InputError(`Text must be at most ${max} characters.`);
  return v === "" ? null : v;
}

/** A positive integer id from the form or URL, or throws. */
export function id(value: FormDataEntryValue | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new InputError("Invalid id.");
  return n;
}

/** Positive integer from a route param, or null (pages call notFound()). */
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function errorMessage(err: unknown): string | null {
  return err instanceof InputError ? err.message : null;
}
