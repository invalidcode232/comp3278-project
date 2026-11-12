import Link from "next/link";
import { notFound } from "next/navigation";
import {
  removeFromCollectionAction,
  saveToCollectionAction,
} from "@/actions/collections";
import { PostCard } from "@/components/PostCard";
import { PostComposer, ComposerDialog } from "@/components/PostComposer";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listCollectionsForPost } from "@/lib/queries/collections";
import { getPost, listReplies, listAncestors } from "@/lib/queries/posts";
import { parseId } from "@/lib/validate";

/** A conversation focuses on one root or reply, with ancestor context and direct children. */
export default async function ThreadPage({
  params,
}: {
  /** Stable route ID; old root URLs survive the migration. */
  params: Promise<{ /** Root or reply ID. */ id: string }>;
}) {
  const postId = parseId((await params).id);
  if (!postId) notFound();
  const me = await getCurrentUser();
  const post = await getPost(pool, me?.id ?? null, postId);
  if (!post) notFound();
  const [ancestors, replies, collections] = await Promise.all([
    listAncestors(pool, me?.id ?? null, post.id),
    listReplies(pool, me?.id ?? null, post.id),
    me && !post.parent_id && !post.deleted_at
      ? listCollectionsForPost(pool, me.id, post.id)
      : Promise.resolve([]),
  ]);
  return (
    <>
      <header className="page-heading">
        <Link
          href={post.parent_id ? `/threads/${post.parent_id}` : "/"}
          className="icon-button"
          aria-label="Back"
        >
          <Icon name="back" />
        </Link>
        <h1>Thread</h1>
        <span />
      </header>
      <section className="feed-surface">
        {ancestors.map(
          /** Keep the parent chain readable without recursively narrowing the content. */
          (parent) => (
            <div className="ancestor" key={parent.id}>
              <PostCard thread={parent} viewer={me} />
            </div>
          ),
        )}
        <PostCard
          thread={post}
          viewer={me}
          extra={
            me && !post.parent_id && !post.deleted_at ? (
              <details className="action-menu save-menu">
                <summary aria-label="Save to collection">
                  <Icon name="bookmark" />
                </summary>
                <div className="menu-panel">
                  <p className="muted">Private collections</p>
                  {collections.map(
                    /** Each save mutation is scoped to the signed-in collection owner. */
                    (c) => (
                      <form
                        key={c.id}
                        action={
                          c.has_post
                            ? removeFromCollectionAction
                            : saveToCollectionAction
                        }
                      >
                        <input
                          type="hidden"
                          name="collection_id"
                          value={c.id}
                        />
                        <input type="hidden" name="post_id" value={post.id} />
                        <button>
                          {c.has_post
                            ? `✓ In “${c.name}” (remove)`
                            : `+ Save to “${c.name}”`}
                        </button>
                      </form>
                    ),
                  )}
                  <Link href="/collections">Manage collections</Link>
                </div>
              </details>
            ) : undefined
          }
        />
        <div className="section-heading">
          <h2>Replies</h2>
          {me && !post.deleted_at && <ComposerDialog parent={post} />}
        </div>
        {me && !post.deleted_at ? (
          <div className="inline-reply">
            <PostComposer parent={post} />
          </div>
        ) : (
          !me && (
            <p className="empty-state">
              <Link href="/login" className="link">
                Log in
              </Link>{" "}
              to reply.
            </p>
          )
        )}
        {replies.map(
          /** Render each child once; its permalink exposes the next conversation level. */
          (reply) => (
            <PostCard key={reply.id} thread={reply} viewer={me} />
          ),
        )}
        {!replies.length && (
          <p className="empty-state">No replies yet. Start the conversation.</p>
        )}
      </section>
    </>
  );
}
