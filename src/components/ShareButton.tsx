"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** Copy the post permalink with brief, announced feedback; never posts to an external service. */
export function ShareButton({
  postId,
}: {
  /** Stable unified post ID used in the existing conversation route. */
  postId: number;
}) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    /** Prevent a delayed status update after navigation. */ () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  /** Copy only the current app's public conversation URL, retaining an error if clipboard access fails. */
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/threads/${postId}`,
      );
      setStatus("Link copied");
    } catch {
      setStatus("Couldn’t copy link");
    }
    timer.current = setTimeout(
      /** Remove transient feedback after users can read it. */ () =>
        setStatus(""),
      2200,
    );
  }
  return (
    <span className="share-control">
      <button
        type="button"
        className="icon-button"
        aria-label="Copy post link"
        onClick={copy}
      >
        <Icon name="share" />
      </button>
      {status && (
        <span role="status" className="share-feedback">
          {status}
        </span>
      )}
    </span>
  );
}
