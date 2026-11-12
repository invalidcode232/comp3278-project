import { createPostAction } from "@/actions/posts";
import { ActionForm } from "./ActionForm";
import { ContentFields } from "./ContentFields";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { TopicPicker } from "./TopicPicker";
import type { PostView } from "@/lib/queries/posts";

/** Shared root/reply form. Replies submit a parent ID; only roots choose a topic. */
export async function PostComposer({
  parent,
  topic,
}: {
  /** Parent context for a reply, absent when creating a root. */
  parent?: PostView;
  /** Optional root topic preselection. */
  topic?: string;
}) {
  const me = await getCurrentUser();
  return (
    <ActionForm
      action={createPostAction}
      className="post-composer"
      submitLabel={parent ? "Reply" : "Post"}
    >
      {parent ? (
        <>
          <input type="hidden" name="parent_id" value={parent.id} />
          <div className="reply-context">
            <strong>@{parent.handle}</strong>
            <p>{parent.body?.slice(0, 240) ?? "Photo"}</p>
            <span className="muted">Replying to @{parent.handle}</span>
          </div>
        </>
      ) : (
        <div className="composer-identity">
          {me && (
            <Avatar
              imageId={me.avatar_image_id}
              name={me.display_name}
              size={36}
            />
          )}
          <strong>{me?.handle}</strong>
          <TopicPicker initialName={topic} />
        </div>
      )}
      <ContentFields
        placeholder={parent ? `Reply to @${parent.handle}…` : "What's new?"}
        rows={3}
      />
    </ActionForm>
  );
}

/** Open the same composer from a feed action or navigation control, without changing routes. */
export function ComposerDialog({
  parent,
  inline = false,
}: {
  /** Target post for a reply; absent creates a root. */
  parent?: PostView;
  /** Render the broad feed composer prompt rather than a compact icon action. */
  inline?: boolean;
}) {
  return (
    <Dialog
      title={parent ? "Reply" : "New thread"}
      triggerClass={inline ? "composer-prompt" : "icon-button"}
      trigger={
        inline ? (
          <>
            <span>What's new?</span>
            <span className="btn-secondary">Post</span>
          </>
        ) : (
          <>
            <Icon name={parent ? "reply" : "plus"} />
            <span className="sr-only">{parent ? "Reply" : "New thread"}</span>
          </>
        )
      }
    >
      <PostComposer parent={parent} />
    </Dialog>
  );
}
