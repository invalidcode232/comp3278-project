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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="link text-sm">
          ← Messages
        </Link>
        <Avatar
          imageId={partner.avatar_image_id}
          name={partner.display_name}
          size={32}
        />
        <Link
          href={`/u/${partner.handle}`}
          className="font-medium hover:underline"
        >
          {partner.display_name}{" "}
          <span className="muted">@{partner.handle}</span>
        </Link>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="muted">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
              >
                {m.body && (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
                {m.image_id && (
                  <img
                    src={imageUrl(m.image_id)}
                    alt=""
                    className="mt-1 max-h-64 rounded"
                  />
                )}
                <div
                  className={`mt-1 text-xs ${mine ? "text-indigo-100" : "text-gray-500"}`}
                >
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
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
