const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format a database timestamp using the shared display formatter. */
export function formatTime(d: Date): string {
  return fmt.format(d);
}

/** Construct the local image endpoint URL for a numeric image identifier. */
export function imageUrl(id: number): string {
  return `/api/images/${id}`;
}
