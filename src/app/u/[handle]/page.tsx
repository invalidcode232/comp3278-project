import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followAction, unfollowAction } from "@/actions/follows";
import { AnimatedCount } from "@/components/AnimatedCount";
import { Avatar } from "@/components/Avatar";
import { PostList } from "@/components/PostList";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getFollowCounts, isFollowing } from "@/lib/queries/follows";
import { listUserPosts } from "@/lib/queries/posts";
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
    listUserPosts(pool, me?.id ?? null, user.id),
  ]);
  const isMe = me?.id === user.id;

  return (
    <div>
      <PageHeader title="Profile" />
      <section className="profile-header">
        <Avatar
          imageId={user.avatar_image_id}
          name={user.display_name}
          size={80}
        />
        <div className="profile-identity">
          <h2 className="profile-name">{user.display_name}</h2>
          <p className="muted">@{user.handle}</p>
          {user.bio && <p className="whitespace-pre-wrap">{user.bio}</p>}
          <p className="text-sm">
            <strong>
              <AnimatedCount value={counts.followers} />
            </strong>{" "}
            {counts.followers === 1 ? "follower" : "followers"} ·{" "}
            <strong>
              <AnimatedCount value={counts.following} />
            </strong>{" "}
            following
          </p>
        </div>
        <div className="profile-actions">
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

      <section>
        <h2 className="profile-tab">Threads</h2>
        <PostList threads={threads} viewer={me} empty="No threads yet." />
      </section>
    </div>
  );
}
