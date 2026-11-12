"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep the latest conversation visible initially; preserve a reader's position unless they are already at the bottom. */
export function ConversationScroll({
  children,
  revision,
}: {
  /** Chronological messages. */
  children: ReactNode;
  /** Last message ID, changes after a send/revalidation. */
  revision: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  useLayoutEffect(
    /** Scroll only this region, leaving the composer and surrounding page stable. */
    () => {
      const element = ref.current;
      if (element && nearBottom.current)
        element.scrollTop = element.scrollHeight;
    },
    [revision],
  );
  return (
    <div
      className="conversation-scroll"
      ref={ref}
      onScroll={
        /** Avoid pulling readers away from older messages when content refreshes. */
        (event) => {
          const e = event.currentTarget;
          nearBottom.current =
            e.scrollHeight - e.clientHeight - e.scrollTop < 80;
        }
      }
      onLoad={
        /** Image loading must not leave the latest message below the viewport. */
        () => {
          const e = ref.current;
          if (e && nearBottom.current) e.scrollTop = e.scrollHeight;
        }
      }
    >
      {children}
    </div>
  );
}
