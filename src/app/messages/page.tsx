import Link from "next/link";
import { Avatar, Stamp } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listConversations } from "@/lib/queries/messages";

export default async function MessagesPage() {
  const me = await requireUser();
  const conversations = await listConversations(pool, me.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Messages</h1>
      {conversations.length === 0 ? (
        <p className="muted">No conversations yet. Open someone’s profile and press “Message”.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {conversations.map((c) => (
            <li key={c.partner_id}>
              <Link href={`/messages/${c.handle}`} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                <Avatar imageId={c.avatar_image_id} name={c.display_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {c.display_name} <span className="muted">@{c.handle}</span>
                    </span>
                    <Stamp at={c.last_created_at} />
                  </div>
                  <p className="truncate text-sm text-gray-600">
                    {c.last_sender_id === me.id ? "You: " : ""}
                    {c.last_body ?? (c.last_image_id ? "📷 Image" : "")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
