import { Icon } from "@/components/Icon";
import { ConversationScroll } from "@/components/ConversationScroll";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sendMessageAction } from "@/actions/messages";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { ContentFields } from "@/components/ContentFields";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { formatTime, imageUrl } from "@/lib/format";
import { listConversation } from "@/lib/queries/messages";
import { getUserByHandle } from "@/lib/queries/users";

/** Require login and render messages exchanged with the handle-selected partner. */
export default async function ConversationPage({
  params,
}: {
  /** Asynchronous route parameters supplied by Next.js. */
  params: Promise<{
    /** Public account handle used in profile URLs. */
    handle: string;
  }>;
}) {
  const me = await requireUser();
  const partner = await getUserByHandle(
    pool,
    decodeURIComponent((await params).handle),
  );
  if (!partner) notFound();
  const messages = await listConversation(pool, me.id, partner.id);

  return (
    <div className="conversation">
      <div className="conversation-heading">
        <Link
          href="/messages"
          className="icon-button"
          aria-label="Back to messages"
        >
          <Icon name="back" />
        </Link>
        <Avatar
          imageId={partner.avatar_image_id}
          name={partner.display_name}
          size={32}
        />
        <Link href={`/u/${partner.handle}`} className="conversation-person">
          {partner.display_name}{" "}
          <span className="muted">@{partner.handle}</span>
        </Link>
      </div>

      <ConversationScroll revision={messages.at(-1)?.id ?? 0}>
        {messages.length === 0 && (
          <p className="muted">No messages yet. Say hello.</p>
        )}
        {messages.map(
          /** Render each message once; sender identity determines right-side alignment, including self-messages. */
          (m) => {
            const mine = m.sender_id === me.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`message-bubble ${mine ? "message-mine" : "message-theirs"}`}
                >
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  {m.image_id && (
                    <img
                      src={imageUrl(m.image_id)}
                      alt="Message attachment"
                      className="mt-1 max-h-64 rounded"
                    />
                  )}
                  <div
                    className={`mt-1 text-xs ${mine ? "text-gray-300" : "text-gray-500"}`}
                  >
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          },
        )}
      </ConversationScroll>

      <div className="conversation-composer">
        <ActionForm
          action={sendMessageAction}
          submitLabel="Send"
          resetOnSuccess
        >
          <input type="hidden" name="to" value={partner.handle} />
          <ContentFields rows={2} placeholder={`Message @${partner.handle}…`} />
        </ActionForm>
      </div>
    </div>
  );
}
