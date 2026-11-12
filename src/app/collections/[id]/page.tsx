import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeFromCollectionAction } from "@/actions/collections";
import { PostCard } from "@/components/PostCard";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getCollection } from "@/lib/queries/collections";
import { listCollectionPosts } from "@/lib/queries/posts";
import { parseId } from "@/lib/validate";

/** Require owner access before rendering saved threads; missing or foreign collections return not-found. */
export default async function CollectionPage({
  params,
}: {
  /** Asynchronous route parameters supplied by Next.js. */
  params: Promise<{
    /** Stable identifier used to reference this record. */
    id: string;
  }>;
}) {
  const me = await requireUser();
  const collectionId = parseId((await params).id);
  if (!collectionId) notFound();
  const collection = await getCollection(pool, me.id, collectionId);
  if (!collection) notFound();
  const threads = await listCollectionPosts(pool, me.id, collectionId);

  return (
    <div>
      <PageHeader title={collection.name} back="/collections" />
      <p className="collection-caption muted">
        Private collection · {threads.length} saved
      </p>
      {threads.length === 0 ? (
        <p className="empty-state">
          Nothing saved here yet. Use “Save to …” on any thread page.
        </p>
      ) : (
        <div className="feed-surface">
          {threads.map(
            /** Render each saved thread with an owner-scoped remove-link action. */
            (t) => (
              <PostCard
                key={t.id}
                thread={t}
                viewer={me}
                extra={
                  <form action={removeFromCollectionAction}>
                    <input
                      type="hidden"
                      name="collection_id"
                      value={collection.id}
                    />
                    <input type="hidden" name="post_id" value={t.id} />
                    <button className="btn-secondary">
                      Remove from collection
                    </button>
                  </form>
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
