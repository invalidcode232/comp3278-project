import Link from "next/link";
import type { ReactNode } from "react";
import { deletePostAction } from "@/actions/posts";
import { setPostLikeAction } from "@/actions/likes";
import type { SessionUser } from "@/lib/queries/sessions";
import type { PostView } from "@/lib/queries/posts";
import { Avatar } from "./Avatar";
import { PostImage } from "./PostImage";
import { Stamp } from "./Stamp";
import { ConfirmButton } from "./ConfirmButton";
import { AnimatedCount } from "./AnimatedCount";
import { LikeButton } from "./LikeButton";
import { Icon } from "./Icon";
import { Menu } from "./Menu";
import { ShareButton } from "./ShareButton";

/** Render any root/reply using a consistent row. Tombstones reveal no original identity or content. */
export function PostCard({
  thread: post,
  viewer,
  extra,
}: {
  /** Unified post projection (legacy prop name retained for list callers). */
  thread: PostView;
  /** Current account or null for visitors. */
  viewer: SessionUser | null;
  /** Optional owner-scoped save/remove controls. */
  extra?: ReactNode;
}) {
  if (post.deleted_at)
    return (
      <article className="post-row tombstone" id={`p${post.id}`}>
        <Icon name="reply" />
        <div>
          <p>Deleted post</p>
          <Link href={`/threads/${post.id}`} className="muted">
            View conversation
          </Link>
        </div>
      </article>
    );
  return (
    <article className="post-row" id={`p${post.id}`}>
      <Link
        className="post-avatar"
        href={`/u/${post.handle}`}
        aria-label={`${post.display_name}'s profile`}
      >
        <Avatar
          imageId={post.avatar_image_id}
          name={post.display_name ?? "User"}
          size={36}
        />
      </Link>
      <div className="post-main">
        <header className="post-meta">
          <Link href={`/u/${post.handle}`} className="post-author">
            {post.handle}
          </Link>
          {post.topic_name && (
            <Link href={`/topics/${post.topic_id}`} className="post-topic">
              › {post.topic_name}
            </Link>
          )}
          <Link href={`/threads/${post.id}`} className="post-time">
            <Stamp at={post.created_at} edited={post.edited} />
          </Link>
          {viewer?.id === post.author_id && (
            <Menu label="Post options" trigger={<Icon name="more" />}>
              <Link href={`/threads/${post.id}/edit`}>Edit</Link>
              <form action={deletePostAction}>
                <input type="hidden" name="post_id" value={post.id} />
                <ConfirmButton message="Delete this post? Its replies will remain under a Deleted post placeholder.">
                  Delete
                </ConfirmButton>
              </form>
            </Menu>
          )}
        </header>
        {post.body && <p className="post-body">{post.body}</p>}
        {post.image_id && <PostImage imageId={post.image_id} />}
        <footer className="post-actions">
          {viewer ? (
            <LikeButton
              liked={Boolean(post.liked_by_me)}
              count={post.like_count}
              action={setPostLikeAction}
              id={post.id}
            />
          ) : (
            <span className="icon-button">
              <Icon name="heart" />
              <AnimatedCount value={post.like_count} />
            </span>
          )}
          <Link
            href={`/threads/${post.id}`}
            className="icon-button"
            aria-label={`${post.reply_count} replies`}
          >
            <Icon name="reply" />
            <AnimatedCount value={post.reply_count} />
          </Link>
          <ShareButton postId={post.id} />
          {extra}
        </footer>
      </div>
    </article>
  );
}
