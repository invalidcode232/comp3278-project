import type { SessionUser } from "@/lib/queries/sessions";
import type { ThreadView } from "@/lib/queries/threads";
import { ThreadCard } from "./ThreadCard";

/** Render thread cards in query order or the supplied empty-state message. */
export function ThreadList({
  threads,
  viewer,
  empty,
}: {
  /** Ordered thread projections to render. */
  threads: ThreadView[]; /** Authenticated viewer, or null for a public visitor. */
  viewer: SessionUser | null; /** Message displayed when the thread list is empty. */
  empty: string;
}) {
  if (threads.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="space-y-3">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} viewer={viewer} />
      ))}
    </div>
  );
}
