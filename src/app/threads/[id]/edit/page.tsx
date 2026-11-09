import Link from "next/link";
import { notFound } from "next/navigation";
import { updateThreadAction } from "@/actions/threads";
import { ActionForm } from "@/components/ActionForm";
import { ContentFields } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getThread } from "@/lib/queries/threads";
import { parseId } from "@/lib/validate";

export default async function EditThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const threadId = parseId((await params).id);
  if (!threadId) notFound();
  const thread = await getThread(pool, me.id, threadId);
  if (!thread || thread.author_id !== me.id) notFound();

  return (
    <div className="card">
      <h1 className="mb-1 text-xl font-semibold">Edit thread</h1>
      <p className="muted mb-4">Topic: {thread.topic_name} (set when the thread was created)</p>
      <ActionForm action={updateThreadAction} submitLabel="Save changes">
        <input type="hidden" name="thread_id" value={thread.id} />
        <ContentFields defaultBody={thread.body} currentImageId={thread.image_id} />
      </ActionForm>
      <Link href={`/threads/${thread.id}`} className="link mt-3 inline-block text-sm">Cancel</Link>
    </div>
  );
}
