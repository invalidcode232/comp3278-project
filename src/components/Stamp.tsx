import { formatTime } from "@/lib/format";

/** Timestamp plus "(edited)" when updated_at > created_at. */
export function Stamp({
  at,
  edited,
}: {
  /** Timestamp to format for display. */
  at: Date;

  /** Whether the modification timestamp is later than creation. */
  edited?: number | boolean;
}) {
  return (
    <span className="muted">
      {formatTime(at)}
      {edited ? " (edited)" : null}
    </span>
  );
}
