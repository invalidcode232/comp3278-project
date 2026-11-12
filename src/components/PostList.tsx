import type { SessionUser } from "@/lib/queries/sessions";
import type { PostView } from "@/lib/queries/posts";
import { PostCard } from "./PostCard";

/** Render thread cards in query order or the supplied empty-state message. */
export function PostList({
  threads,
  viewer,
  empty,
}: {
  /** Ordered thread projections to render. */
  threads: PostView[];

  /** Authenticated viewer, or null for a public visitor. */
  viewer: SessionUser | null;

  /** Message displayed when the thread list is empty. */
  empty: string;
}) {
  if (threads.length === 0)
    return <p className="empty-state feed-surface">{empty}</p>;
  return (
    <div className="feed-surface">
      {threads.map(
        /** Render each query result once, keyed by its stable thread ID. */
        (t) => (
          <PostCard key={t.id} thread={t} viewer={viewer} />
        ),
      )}
    </div>
  );
}
