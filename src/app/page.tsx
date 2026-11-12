import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listAllPosts, listFollowingPosts } from "@/lib/queries/posts";
import { ComposerDialog } from "@/components/PostComposer";
import { Avatar } from "@/components/Avatar";
import { PostList } from "@/components/PostList";

/** Read the selected all/following feed for the current viewer and render thread cards. */
export default async function FeedPage({
  searchParams,
}: {
  /** Asynchronous URL query parameters supplied by Next.js. */
  searchParams: Promise<{
    /** Requested feed selection; defaults to all threads. */
    tab?: string;
  }>;
}) {
  const { tab } = await searchParams;
  const me = await getCurrentUser();
  const following = tab === "following";

  const tabClass =
    /** Select active-tab styling without changing the requested feed. */
    (active: boolean) => (active ? "feed-tab active" : "feed-tab");

  return (
    <div>
      <header className="page-heading">
        <h1>Home</h1>
      </header>
      <div className="feed-tabs">
        <Link
          href="/"
          aria-current={!following ? "page" : undefined}
          className={tabClass(!following)}
        >
          For you
        </Link>
        <Link
          href="/?tab=following"
          aria-current={following ? "page" : undefined}
          className={tabClass(following)}
        >
          Following
        </Link>
      </div>
      {me && (
        <div className="feed-composer">
          <Avatar
            imageId={me.avatar_image_id}
            name={me.display_name}
            size={36}
          />
          <ComposerDialog inline />
        </div>
      )}
      {following && !me ? (
        <p className="muted">
          <Link href="/login" className="link">
            Log in
          </Link>{" "}
          to see threads from people you follow.
        </p>
      ) : (
        <PostList
          threads={
            following && me
              ? await listFollowingPosts(pool, me.id)
              : await listAllPosts(pool, me?.id ?? null)
          }
          viewer={me}
          empty={
            following
              ? "Nobody you follow has posted yet. Follow people from their profile pages."
              : "No threads yet."
          }
        />
      )}
    </div>
  );
}
