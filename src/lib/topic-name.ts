import { InputError } from "./validate";

/** Normalize public topic labels consistently for search and creation; preserve display casing. */
export function normalizeTopicName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

/** Require a nonempty label of at most 50 Unicode code points, without invisible control characters. */
export function validateTopicName(value: string): string {
  const name = normalizeTopicName(value);
  if (!name || [...name].length > 50 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new InputError(
      "Enter a topic with 1–50 characters and no control characters.",
    );
  }
  return name;
}
