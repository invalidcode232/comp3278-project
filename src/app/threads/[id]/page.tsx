import Link from "next/link";
import { notFound } from "next/navigation";
import { removeFromCollectionAction, saveToCollectionAction } from "@/actions/collections";
import { createCommentAction, deleteCommentAction, updateCommentAction } from "@/actions/comments";
import { toggleCommentLikeAction } from "@/actions/likes";
import { ActionForm } from "@/components/ActionForm";
import { Avatar, ContentFields, PostImage, Stamp } from "@/components/bits";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ThreadCard } from "@/components/ThreadCard";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listCollectionsForThread } from "@/lib/queries/collections";
import { listComments } from "@/lib/queries/comments";
import { getThread } from "@/lib/queries/threads";
import { parseId } from "@/lib/validate";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editComment?: string }>;
}) {
  const threadId = parseId((await params).id);
  if (!threadId) notFound();
  const editingId = parseId((await searchParams).editComment ?? "");
  const me = await getCurrentUser();
  const viewerId = me?.id ?? null;

  const [thread, comments, collections] = await Promise.all([
    getThread(pool, viewerId, threadId),
    listComments(pool, viewerId, threadId),
    me ? listCollectionsForThread(pool, me.id, threadId) : Promise.resolve([]),
  ]);
  if (!thread) notFound();

  return (
    <div className="space-y-6">
      <ThreadCard thread={thread} viewer={me} />

      {me && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold">Collections</h2>
          {collections.length === 0 ? (
            <p className="muted">
              You have no collections. <Link href="/collections" className="link">Create one</Link> to save threads.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <form key={c.id} action={c.has_thread ? removeFromCollectionAction : saveToCollectionAction}>
                  <input type="hidden" name="collection_id" value={c.id} />
                  <input type="hidden" name="thread_id" value={thread.id} />
                  <button className={c.has_thread ? "btn" : "btn-secondary"}>
                    {c.has_thread ? `✓ In “${c.name}” (remove)` : `+ Save to “${c.name}”`}
                  </button>
                </form>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Comments ({comments.length})</h2>
        {comments.map((c) => {
          const mine = me?.id === c.author_id;
          const editing = mine && editingId === c.id;
          return (
            <div key={c.id} id={`c${c.id}`} className="card">
              <div className="flex items-center gap-2">
                <Avatar imageId={c.avatar_image_id} name={c.display_name} size={32} />
                <Link href={`/u/${c.handle}`} className="text-sm font-medium hover:underline">{c.display_name}</Link>
                <span className="muted">@{c.handle} ·</span>
                <Stamp at={c.created_at} edited={c.edited} />
              </div>
              {editing ? (
                <div className="mt-3">
                  <ActionForm action={updateCommentAction} submitLabel="Save comment">
                    <input type="hidden" name="comment_id" value={c.id} />
                    <ContentFields defaultBody={c.body} currentImageId={c.image_id} rows={3} />
                  </ActionForm>
                  <Link href={`/threads/${thread.id}#c${c.id}`} className="link mt-2 inline-block text-sm">Cancel</Link>
                </div>
              ) : (
                <>
                  {c.body && <p className="mt-2 whitespace-pre-wrap break-words">{c.body}</p>}
                  {c.image_id && <PostImage imageId={c.image_id} />}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {me ? (
                      <form action={toggleCommentLikeAction}>
                        <input type="hidden" name="comment_id" value={c.id} />
                        <button className={c.liked_by_me ? "btn" : "btn-secondary"}>
                          {c.liked_by_me ? "♥" : "♡"} {c.like_count}
                        </button>
                      </form>
                    ) : (
                      <span className="muted">♡ {c.like_count}</span>
                    )}
                    {mine && (
                      <>
                        <Link href={`/threads/${thread.id}?editComment=${c.id}#c${c.id}`} className="btn-secondary">Edit</Link>
                        <form action={deleteCommentAction}>
                          <input type="hidden" name="comment_id" value={c.id} />
                          <ConfirmButton message="Delete this comment?">Delete</ConfirmButton>
                        </form>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {me ? (
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">Add a comment</h3>
            <ActionForm action={createCommentAction} submitLabel="Comment" resetOnSuccess>
              <input type="hidden" name="thread_id" value={thread.id} />
              <ContentFields rows={3} placeholder="Write a comment…" />
            </ActionForm>
          </div>
        ) : (
          <p className="muted"><Link href="/login" className="link">Log in</Link> to comment.</p>
        )}
      </section>
    </div>
  );
}
