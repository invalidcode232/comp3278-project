"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatedCount } from "./AnimatedCount";

/** Shared optimistic like control for posts and replies; failed actions roll back to server props. */
export function LikeButton({ liked, count, action, field, id }: {
  /** Whether the authenticated viewer currently likes this item. */
  liked: boolean;
  /** Current count supplied by the server query. */
  count: number;
  /** Authorized server action that toggles the relationship and revalidates the page. */
  action: (data: FormData) => Promise<void>;
  /** Existing server action's identifier field; removed when the entities are unified. */
  field: "thread_id" | "comment_id";
  /** Stable target record identifier. */
  id: number;
}) {
  const [optimistic, toggle] = useOptimistic(
    { liked, count },
    /** Apply the pending toggle to the latest server state without allowing a negative count. */
    (state, nextLiked: boolean) => ({
      liked: nextLiked,
      count: Math.max(0, state.count + Number(nextLiked) - Number(state.liked)),
    }),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const locked = useRef(false);

  /** Start one toggle immediately; serialize repeat clicks and restore authoritative state on failure. */
  function submit() {
    if (locked.current) return;
    locked.current = true;
    setError(false);
    startTransition(
      /** Keep the optimistic state until the server mutation and revalidation finish. */
      async () => {
        toggle(!optimistic.liked);
        const data = new FormData();
        data.set(field, String(id));
        try {
          await action(data);
        } catch {
          setError(true);
        } finally {
          locked.current = false;
        }
      },
    );
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className="like-button"
        aria-pressed={optimistic.liked}
        aria-label={`${optimistic.liked ? "♥ Liked" : "♡ Like"} · ${optimistic.count}`}
        aria-busy={pending}
        disabled={pending}
        onClick={submit}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="like-heart" width="20" height="20">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
        <AnimatedCount value={optimistic.count} />
      </button>
      {error && <span role="alert" className="text-xs text-red-700">Couldn’t save like. Try again.</span>}
    </span>
  );
}
