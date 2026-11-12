import { PageHeader } from "@/components/PageHeader";
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
    <div>
      <PageHeader title={topic.name} back="/topics" />
      <div className="topic-intro">
        <div>
          <span className="topic-symbol" aria-hidden="true">
            #
          </span>
          <p className="muted">
            {topic.description || `Conversations about ${topic.name}.`}
          </p>
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
