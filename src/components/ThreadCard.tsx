import Link from "next/link";
import type { ReactNode } from "react";
import { deleteThreadAction } from "@/actions/threads";
import { toggleThreadLikeAction } from "@/actions/likes";
import type { SessionUser } from "@/lib/queries/sessions";
import type { ThreadView } from "@/lib/queries/threads";
import { Avatar, PostImage, Stamp } from "./bits";
import { ConfirmButton } from "./ConfirmButton";

export function ThreadCard({
  thread: t,
  viewer,
  extra,
}: {
  thread: ThreadView;
  viewer: SessionUser | null;
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
        <Link href={`/topics/${t.topic_id}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200">
          {t.topic_name}
        </Link>
      </header>

      {t.body && <p className="mt-3 whitespace-pre-wrap break-words">{t.body}</p>}
      {t.image_id && <PostImage imageId={t.image_id} />}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {viewer ? (
          <form action={toggleThreadLikeAction}>
            <input type="hidden" name="thread_id" value={t.id} />
            <button className={t.liked_by_me ? "btn" : "btn-secondary"}>
              {t.liked_by_me ? "♥ Liked" : "♡ Like"} · {t.like_count}
            </button>
          </form>
        ) : (
          <span className="muted">♡ {t.like_count}</span>
        )}
        <Link href={`/threads/${t.id}`} className="btn-secondary">
          💬 {t.comment_count}
        </Link>
        {mine && (
          <>
            <Link href={`/threads/${t.id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <form action={deleteThreadAction}>
              <input type="hidden" name="thread_id" value={t.id} />
              <ConfirmButton message="Delete this thread and all its comments?">Delete</ConfirmButton>
            </form>
          </>
        )}
        {extra}
      </footer>
    </article>
  );
}

export function ThreadList({ threads, viewer, empty }: { threads: ThreadView[]; viewer: SessionUser | null; empty: string }) {
  if (threads.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="space-y-3">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} viewer={viewer} />
      ))}
    </div>
  );
}
