import Link from "next/link";
import { pool } from "@/lib/db";
import { listTopicsWithCounts } from "@/lib/queries/topics";
import { normalizeTopicName } from "@/lib/topic-name";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";

/** Search shared vocabulary; topics are introduced through post creation, never this read-only directory. */
export default async function TopicsPage({
  searchParams,
}: {
  /** Optional literal topic substring from the GET form. */ searchParams: Promise<{
    /** Search text. */ q?: string;
  }>;
}) {
  const q = normalizeTopicName((await searchParams).q ?? "").slice(0, 100);
  const topics = await listTopicsWithCounts(pool, q);
  return (
    <>
      <PageHeader title="Topics" />
      <section className="directory-surface">
        <form action="/topics" className="search-field" role="search">
          <Icon name="search" />
          <input
            name="q"
            aria-label="Search topics"
            placeholder="Search topics"
            defaultValue={q}
            maxLength={100}
          />
          {q && (
            <Link
              href="/topics"
              className="icon-button"
              aria-label="Clear search"
            >
              <Icon name="close" />
            </Link>
          )}
          <button type="submit" className="text-button">
            Search
          </button>
        </form>
        <div className="directory-intro">
          <h2>Find your conversations</h2>
          <p className="muted">Explore a topic, or start one when you post.</p>
        </div>
        {topics.length ? (
          <ul className="directory-list">
            {topics.map(
              /** Topic labels remain shared and immutable on existing posts. */ (
                t,
              ) => (
                <li key={t.id}>
                  <Link href={`/topics/${t.id}`} className="directory-row">
                    <span className="topic-symbol" aria-hidden="true">
                      #
                    </span>
                    <div className="row-content">
                      <strong>{t.name}</strong>
                      {t.description && <p>{t.description}</p>}
                      <span className="muted">
                        {t.post_count}{" "}
                        {t.post_count === 1 ? "thread" : "threads"}
                      </span>
                    </div>
                    <span className="row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        ) : (
          <div className="empty-state">
            <Icon name="search" />
            <h2>No matching topics</h2>
            <p>Try another word, or create this topic in a new thread.</p>
            <Link href="/threads/new" className="btn-secondary">
              Start a thread
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
