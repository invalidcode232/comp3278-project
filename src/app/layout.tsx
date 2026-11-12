import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import "./globals.css";

// Every page depends on the logged-in user and live data, so never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COMP3278 Social",
  description: "A small social app built on hand-written MySQL.",
};

/** Render navigation for the current session and the page content; authentication is still enforced in protected actions. */
export default async function RootLayout({
  children,
}: {
  /** Nested content rendered inside this component. */
  children: ReactNode;
}) {
  const me = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold text-indigo-700">
              COMP3278 Social
            </Link>
            <Link href="/" className="hover:underline">
              Feed
            </Link>
            <Link href="/topics" className="hover:underline">
              Topics
            </Link>
            {me && (
              <>
                <Link href="/collections" className="hover:underline">
                  Collections
                </Link>
                <Link href="/messages" className="hover:underline">
                  Messages
                </Link>
              </>
            )}
            <span className="flex-1" />
            {me ? (
              <>
                <Link href="/threads/new" className="btn">
                  New thread
                </Link>
                <Link
                  href={`/u/${me.handle}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Avatar
                    imageId={me.avatar_image_id}
                    name={me.display_name}
                    size={28}
                  />
                  @{me.handle}
                </Link>
                <Link href="/settings" className="hover:underline">
                  Settings
                </Link>
                <form action={logoutAction}>
                  <button className="hover:underline">Log out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:underline">
                  Log in
                </Link>
                <Link href="/signup" className="btn">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
