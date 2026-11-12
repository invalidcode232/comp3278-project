import { createPostAction } from "@/actions/posts";
import { ActionForm } from "./ActionForm";
import { ContentFields } from "./ContentFields";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import type { TopicRow } from "@/lib/queries/topics";
import type { PostView } from "@/lib/queries/posts";

/** Shared root/reply form. Replies submit a parent ID; only roots choose a topic. */
export function PostComposer({
  parent,
  topics = [],
  topic,
}: {
  /** Parent context for a reply, absent when creating a root. */
  parent?: PostView;
  /** Seeded root topic choices. */
  topics?: TopicRow[];
  /** Optional root topic preselection. */
  topic?: string;
}) {
  return (
    <ActionForm
      action={createPostAction}
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
        <label className="label">
          Topic
          <select
            name="topic_id"
            aria-label="Topic"
            required
            defaultValue={topic ?? ""}
            className="input mt-2"
          >
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map(
              /** Topics remain immutable after a root is created. */
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ),
            )}
          </select>
        </label>
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
  topics = [],
  inline = false,
}: {
  /** Target post for a reply; absent creates a root. */
  parent?: PostView;
  /** Root creation topic choices. */
  topics?: TopicRow[];
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
      <PostComposer parent={parent} topics={topics} />
    </Dialog>
  );
}
