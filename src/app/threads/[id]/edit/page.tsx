import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePostAction } from "@/actions/posts";
import { ActionForm } from "@/components/ActionForm";
import { ContentFields } from "@/components/ContentFields";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getPost } from "@/lib/queries/posts";
import { parseId } from "@/lib/validate";

/** Require the thread’s author before rendering text/image editing with a fixed topic. */
export default async function EditThreadPage({
  params,
}: {
  /** Asynchronous route parameters supplied by Next.js. */
  params: Promise<{
    /** Stable identifier used to reference this record. */
    id: string;
  }>;
}) {
  const me = await requireUser();
  const threadId = parseId((await params).id);
  if (!threadId) notFound();
  const thread = await getPost(pool, me.id, threadId);
  if (!thread || thread.author_id !== me.id) notFound();

  return (
    <div className="card">
      <h1 className="mb-1 text-xl font-semibold">
        Edit {thread.parent_id ? "reply" : "thread"}
      </h1>
      <p className="muted mb-4">
        {thread.topic_name
          ? `Topic: ${thread.topic_name} (fixed at creation)`
          : "Reply context stays unchanged."}
      </p>
      <ActionForm action={updatePostAction} submitLabel="Save changes">
        <input type="hidden" name="post_id" value={thread.id} />
        <ContentFields
          defaultBody={thread.body}
          currentImageId={thread.image_id}
        />
      </ActionForm>
      <Link
        href={`/threads/${thread.id}`}
        className="link mt-3 inline-block text-sm"
      >
        Cancel
      </Link>
    </div>
  );
}
