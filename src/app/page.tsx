import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listAllThreads, listFollowingThreads } from "@/lib/queries/threads";
import { ThreadList } from "@/components/ThreadList";

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

  const tabClass = (active: boolean) =>
    active
      ? "border-b-2 border-indigo-600 pb-1 font-medium"
      : "pb-1 text-gray-500 hover:text-gray-800";

  return (
    <div className="space-y-4">
      <div className="flex gap-6">
        <Link href="/" className={tabClass(!following)}>
          All
        </Link>
        <Link href="/?tab=following" className={tabClass(following)}>
          Following
        </Link>
      </div>
      {following && !me ? (
        <p className="muted">
          <Link href="/login" className="link">
            Log in
          </Link>{" "}
          to see threads from people you follow.
        </p>
      ) : (
        <ThreadList
          threads={
            following && me
              ? await listFollowingThreads(pool, me.id)
              : await listAllThreads(pool, me?.id ?? null)
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
