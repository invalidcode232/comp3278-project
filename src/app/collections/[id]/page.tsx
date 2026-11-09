import Link from "next/link";
import { notFound } from "next/navigation";
import { removeFromCollectionAction } from "@/actions/collections";
import { ThreadCard } from "@/components/ThreadCard";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getCollection } from "@/lib/queries/collections";
import { listCollectionThreads } from "@/lib/queries/threads";
import { parseId } from "@/lib/validate";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const collectionId = parseId((await params).id);
  if (!collectionId) notFound();
  const collection = await getCollection(pool, me.id, collectionId);
  if (!collection) notFound();
  const threads = await listCollectionThreads(pool, me.id, collectionId);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/collections" className="link text-sm">← All collections</Link>
        <h1 className="text-xl font-semibold">{collection.name}</h1>
      </div>
      {threads.length === 0 ? (
        <p className="muted">Nothing saved here yet. Use “Save to …” on any thread page.</p>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              viewer={me}
              extra={
                <form action={removeFromCollectionAction}>
                  <input type="hidden" name="collection_id" value={collection.id} />
                  <input type="hidden" name="thread_id" value={t.id} />
                  <button className="btn-secondary">Remove from collection</button>
                </form>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
