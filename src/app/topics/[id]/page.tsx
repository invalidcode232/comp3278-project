import Link from "next/link";
import { notFound } from "next/navigation";
import { ThreadList } from "@/components/ThreadCard";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getTopic } from "@/lib/queries/topics";
import { listTopicThreads } from "@/lib/queries/threads";
import { parseId } from "@/lib/validate";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const topicId = parseId((await params).id);
  if (!topicId) notFound();
  const topic = await getTopic(pool, topicId);
  if (!topic) notFound();
  const me = await getCurrentUser();
  const threads = await listTopicThreads(pool, me?.id ?? null, topicId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{topic.name}</h1>
          <p className="muted">{topic.description}</p>
        </div>
        {me && (
          <Link href={`/threads/new?topic=${topic.id}`} className="btn">New thread here</Link>
        )}
      </div>
      <ThreadList threads={threads} viewer={me} empty="No threads in this topic yet." />
    </div>
  );
}
