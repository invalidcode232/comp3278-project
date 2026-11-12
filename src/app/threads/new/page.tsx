import { PostComposer } from "@/components/PostComposer";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listTopics } from "@/lib/queries/topics";

/** Full-page fallback for creating a root post; navigation also offers the modal composer. */
export default async function NewThreadPage({
  searchParams,
}: {
  /** Optional topic selection from a topic page. */
  searchParams: Promise<{ /** Seeded topic ID. */ topic?: string }>;
}) {
  await requireUser();
  const { topic } = await searchParams;
  return (
    <>
      <header className="page-heading">
        <h1>New thread</h1>
      </header>
      <section className="card">
        <PostComposer topics={await listTopics(pool)} topic={topic} />
      </section>
    </>
  );
}
