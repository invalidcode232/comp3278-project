import Link from "next/link";
import { pool } from "@/lib/db";
import { listTopicsWithCounts } from "@/lib/queries/topics";

/** Render seeded topics with current thread counts. */
export default async function TopicsPage() {
  const topics = await listTopicsWithCounts(pool);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Topics</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {topics.map(
          /** Render each public seeded topic with its computed thread count. */
          (t) => (
            <li key={t.id}>
              <Link
                href={`/topics/${t.id}`}
                className="card block hover:border-indigo-300"
              >
                <div className="font-medium">{t.name}</div>
                <p className="muted">{t.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t.post_count} threads
                </p>
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
