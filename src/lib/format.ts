const fmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(d: Date): string {
  return fmt.format(d);
}

export function imageUrl(id: number): string {
  return `/api/images/${id}`;
}
