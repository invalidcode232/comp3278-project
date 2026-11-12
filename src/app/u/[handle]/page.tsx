import Link from "next/link";
import { notFound } from "next/navigation";
import { followAction, unfollowAction } from "@/actions/follows";
import { AnimatedCount } from "@/components/AnimatedCount";
import { Avatar } from "@/components/Avatar";
import { ThreadList } from "@/components/ThreadList";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { formatTime } from "@/lib/format";
import { getFollowCounts, isFollowing } from "@/lib/queries/follows";
import { listUserThreads } from "@/lib/queries/threads";
import { getUserByHandle } from "@/lib/queries/users";

/** Render a public profile, follow counts, threads, and viewer-specific controls. */
export default async function ProfilePage({
  params,
}: {
  /** Asynchronous route parameters supplied by Next.js. */
  params: Promise<{
    /** Public account handle used in profile URLs. */
    handle: string;
  }>;
}) {
  const { handle } = await params;
  const me = await getCurrentUser();
  const user = await getUserByHandle(pool, decodeURIComponent(handle));
  if (!user) notFound();

  const [counts, iFollow, threads] = await Promise.all([
    getFollowCounts(pool, user.id),
    me && me.id !== user.id
      ? isFollowing(pool, me.id, user.id)
      : Promise.resolve(false),
    listUserThreads(pool, me?.id ?? null, user.id),
  ]);
  const isMe = me?.id === user.id;

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-start gap-4">
        <Avatar
          imageId={user.avatar_image_id}
          name={user.display_name}
          size={80}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold">{user.display_name}</h1>
          <p className="muted">
            @{user.handle} · joined {formatTime(user.created_at)}
          </p>
          {user.bio && <p className="whitespace-pre-wrap">{user.bio}</p>}
          <p className="text-sm">
            <strong><AnimatedCount value={counts.followers} /></strong>{" "}
            {counts.followers === 1 ? "follower" : "followers"} ·{" "}
            <strong><AnimatedCount value={counts.following} /></strong> following
          </p>
        </div>
        <div className="flex gap-2">
          {isMe && (
            <Link href="/settings" className="btn-secondary">
              Edit profile
            </Link>
          )}
          {isMe && (
            <Link href={`/messages/${user.handle}`} className="btn-secondary">
              Message yourself
            </Link>
          )}
          {me && !isMe && (
            <>
              <form action={iFollow ? unfollowAction : followAction}>
                <input type="hidden" name="handle" value={user.handle} />
                <button className={iFollow ? "btn-secondary" : "btn"}>
                  {iFollow ? "Unfollow" : "Follow"}
                </button>
              </form>
              <Link href={`/messages/${user.handle}`} className="btn-secondary">
                Message
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Threads by @{user.handle}</h2>
        <ThreadList threads={threads} viewer={me} empty="No threads yet." />
      </section>
    </div>
  );
}
