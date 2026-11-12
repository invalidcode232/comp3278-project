import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Stamp } from "@/components/Stamp";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listConversations } from "@/lib/queries/messages";

/** Require login and render the latest message for each conversation partner. */
export default async function MessagesPage() {
  const me = await requireUser();
  const conversations = await listConversations(pool, me.id);

  return (
    <div>
      <PageHeader title="Messages" />
      <div className="directory-surface">
        <Link
          href={`/messages/${me.handle}`}
          className="self-message-link directory-row"
        >
          <span className="topic-symbol">
            <Icon name="user" />
          </span>
          <span>
            <strong>Message yourself</strong>
            <span className="muted block">A space for notes and reminders</span>
          </span>
        </Link>
        {conversations.length === 0 ? (
          <div className="empty-state">
            <Icon name="send" />
            <h2>Your conversations start here</h2>
            <p>Open someone’s profile and choose Message.</p>
          </div>
        ) : (
          <ul className="directory-list">
            {conversations.map(
              /** Render one latest-message summary per conversation partner, including self. */
              (c) => (
                <li key={c.partner_id}>
                  <Link
                    href={`/messages/${c.handle}`}
                    className="directory-row conversation-row"
                  >
                    <Avatar imageId={c.avatar_image_id} name={c.display_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">
                          {c.display_name}{" "}
                          <span className="muted">@{c.handle}</span>
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
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
