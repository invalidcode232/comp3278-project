import Link from "next/link";
import { notFound } from "next/navigation";
import { PostList } from "@/components/PostList";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getTopic } from "@/lib/queries/topics";
import { listTopicPosts } from "@/lib/queries/posts";
import { parseId } from "@/lib/validate";

/** Resolve the topic and render its newest threads for the current viewer. */
export default async function TopicPage({
  params,
}: {
  /** Asynchronous route parameters supplied by Next.js. */
  params: Promise<{
    /** Stable identifier used to reference this record. */
    id: string;
  }>;
}) {
  const topicId = parseId((await params).id);
  if (!topicId) notFound();
  const topic = await getTopic(pool, topicId);
  if (!topic) notFound();
  const me = await getCurrentUser();
  const threads = await listTopicPosts(pool, me?.id ?? null, topicId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{topic.name}</h1>
          <p className="muted">{topic.description}</p>
        </div>
        {me && (
          <Link href={`/threads/new?topic=${topic.id}`} className="btn">
            New thread here
          </Link>
        )}
      </div>
      <PostList
        threads={threads}
        viewer={me}
        empty="No threads in this topic yet."
      />
    </div>
  );
}
