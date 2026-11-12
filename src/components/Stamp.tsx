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
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(at).getTime()) / 1000),
  );
  const relative =
    seconds < 60
      ? "now"
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m`
        : seconds < 86400
          ? `${Math.floor(seconds / 3600)}h`
          : `${Math.floor(seconds / 86400)}d`;
  return (
    <time
      dateTime={new Date(at).toISOString()}
      title={formatTime(at)}
      className="muted"
    >
      {relative}
      {edited ? " · edited" : ""}
    </time>
  );
}
