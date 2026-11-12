import Link from "next/link";
import {
  createCollectionAction,
  deleteCollectionAction,
  renameCollectionAction,
} from "@/actions/collections";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listCollections } from "@/lib/queries/collections";

/** Require login and render only the viewer’s private collections and management forms. */
export default async function CollectionsPage() {
  const me = await requireUser();
  const collections = await listCollections(pool, me.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Your collections</h1>

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold">New collection</h2>
        <ActionForm
          action={createCollectionAction}
          submitLabel="Create"
          className="flex flex-wrap items-center gap-2"
          resetOnSuccess
        >
          <input
            name="name"
            required
            maxLength={50}
            placeholder="e.g. Exam prep"
            className="input w-60"
          />
        </ActionForm>
      </section>

      {collections.length === 0 ? (
        <p className="muted">
          No collections yet. Save threads into one from a thread page.
        </p>
      ) : (
        <ul className="space-y-3">
          {collections.map(
            /** Render the owner’s collection with rename/delete controls and saved-thread count. */
            (c) => (
              <li key={c.id} className="card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/collections/${c.id}`}
                    className="font-medium link"
                  >
                    {c.name}
                  </Link>
                  <span className="muted">{c.thread_count} saved</span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <ActionForm
                    action={renameCollectionAction}
                    submitLabel="Rename"
                    buttonClassName="btn-secondary"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="collection_id" value={c.id} />
                    <input
                      name="name"
                      required
                      maxLength={50}
                      defaultValue={c.name}
                      className="input w-60"
                      aria-label="New name"
                    />
                  </ActionForm>
                  <form action={deleteCollectionAction}>
                    <input type="hidden" name="collection_id" value={c.id} />
                    <ConfirmButton
                      message={`Delete the collection “${c.name}”? The threads themselves are not deleted.`}
                    >
                      Delete
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
