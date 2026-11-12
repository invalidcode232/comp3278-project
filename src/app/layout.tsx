import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listTopicsWithCounts } from "@/lib/queries/topics";
import { Navigation } from "@/components/Navigation";
import { ComposerDialog } from "@/components/PostComposer";
import "./globals.css";

/** Session-dependent pages are rendered at request time. */
export const dynamic = "force-dynamic";
/** Browser title and product description. */
export const metadata: Metadata = {
  title: "Threadly",
  description: "Small conversations. Real connections.",
};
/** Shared desktop rail/mobile navigation, centered content column, and topic discovery panel. */
export default async function RootLayout({
  children,
}: {
  /** Route content. */
  children: ReactNode;
}) {
  const [me, topics] = await Promise.all([
    getCurrentUser(),
    listTopicsWithCounts(pool),
  ]);
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Navigation
          handle={me?.handle ?? null}
          composer={me ? <ComposerDialog /> : null}
        />
        <div className="app-shell">
          <main id="main-content" className="content-column">
            {children}
          </main>
          <aside className="discovery-panel" aria-label="Discover">
            <h2>Find your conversations</h2>
            <p className="muted">Explore what’s happening around campus.</p>
            <div className="discovery-topics">
              {topics.slice(0, 6).map(
                /** Preview shared topics; the directory contains the complete searchable vocabulary. */
                (topic) => (
                  <Link href={`/topics/${topic.id}`} key={topic.id}>
                    <strong>{topic.name}</strong>
                    <span>
                      {topic.post_count}{" "}
                      {topic.post_count === 1 ? "thread" : "threads"}
                    </span>
                  </Link>
                ),
              )}
            </div>
            <Link href="/topics" className="text-button discovery-all">
              Explore all topics →
            </Link>
            {!me && (
              <Link href="/signup" className="btn">
                Join Threadly
              </Link>
            )}
            <footer className="muted">
              Threadly · COMP3278
              <br />A place for your conversations.
            </footer>
          </aside>
        </div>
      </body>
    </html>
  );
}
