import Link from "next/link";
import type { ReactNode } from "react";
import { deleteThreadAction } from "@/actions/threads";
import { toggleThreadLikeAction } from "@/actions/likes";
import type { SessionUser } from "@/lib/queries/sessions";
import type { ThreadView } from "@/lib/queries/threads";
import { Avatar } from "@/components/Avatar";
import { PostImage } from "@/components/PostImage";
import { Stamp } from "@/components/Stamp";
import { AnimatedCount } from "./AnimatedCount";
import { LikeButton } from "./LikeButton";
import { ConfirmButton } from "./ConfirmButton";

/** Render one thread with counts and viewer-dependent controls; server actions enforce ownership. */
export function ThreadCard({
  thread: t,
  viewer,
  extra,
}: {
  /** Query projection rendered as a thread card. */
  thread: ThreadView;

  /** Authenticated viewer, or null for a public visitor. */
  viewer: SessionUser | null;

  /** Optional controls appended to the thread card footer. */
  extra?: ReactNode;
}) {
  const mine = viewer?.id === t.author_id;
  return (
    <article className="card">
      <header className="flex items-center gap-3">
        <Avatar imageId={t.avatar_image_id} name={t.display_name} />
        <div className="min-w-0 flex-1">
          <Link href={`/u/${t.handle}`} className="font-medium hover:underline">
            {t.display_name}
          </Link>{" "}
          <span className="muted">@{t.handle}</span>
          <div>
            <Link href={`/threads/${t.id}`} className="hover:underline">
              <Stamp at={t.created_at} edited={t.edited} />
            </Link>
          </div>
        </div>
        <Link
          href={`/topics/${t.topic_id}`}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
        >
          {t.topic_name}
        </Link>
      </header>

      {t.body && (
        <p className="mt-3 whitespace-pre-wrap break-words">{t.body}</p>
      )}
      {t.image_id && <PostImage imageId={t.image_id} />}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {viewer ? (
          <LikeButton
            liked={Boolean(t.liked_by_me)}
            count={t.like_count}
            action={toggleThreadLikeAction}
            field="thread_id"
            id={t.id}
          />
        ) : (
          <span className="muted">♡ {t.like_count}</span>
        )}
        <Link href={`/threads/${t.id}`} className="btn-secondary">
          💬 <AnimatedCount value={t.comment_count} />
        </Link>
        {mine && (
          <>
            <Link href={`/threads/${t.id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <form action={deleteThreadAction}>
              <input type="hidden" name="thread_id" value={t.id} />
              <ConfirmButton message="Delete this thread and all its comments?">
                Delete
              </ConfirmButton>
            </form>
          </>
        )}
        {extra}
      </footer>
    </article>
  );
}
