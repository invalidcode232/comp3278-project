import { createThreadAction } from "@/actions/threads";
import { ActionForm } from "@/components/ActionForm";
import { ContentFields } from "@/components/ContentFields";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listTopics } from "@/lib/queries/topics";

/** Require login and render thread creation with seeded topic choices. */
export default async function NewThreadPage({
  searchParams,
}: {
  /** Asynchronous URL query parameters supplied by Next.js. */
  searchParams: Promise<{
    /** Optional topic selection for the creation form. */
    topic?: string;
  }>;
}) {
  await requireUser();
  const { topic } = await searchParams;
  const topics = await listTopics(pool);

  return (
    <div className="card">
      <h1 className="mb-4 text-xl font-semibold">New thread</h1>
      <ActionForm action={createThreadAction} submitLabel="Post thread">
        <div>
          <label className="label" htmlFor="topic_id">
            Topic
          </label>
          <select
            id="topic_id"
            name="topic_id"
            required
            defaultValue={topic ?? ""}
            className="input"
          >
            <option value="" disabled>
              Choose a topic…
            </option>
            {topics.map(
              /** Render each seeded topic as a required creation-time choice. */
              (t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ),
            )}
          </select>
        </div>
        <ContentFields placeholder="What's on your mind? (text, an image, or both)" />
      </ActionForm>
    </div>
  );
}
