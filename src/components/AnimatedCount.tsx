"use client";

import { useState } from "react";

/** Roll a changing nonnegative count vertically; expose only the current value to assistive technology.
 * Initial rendering is static. Subsequent values interrupt the previous animation;
 * CSS suppresses movement when the user requests reduced motion.
 */
export function AnimatedCount({ value }: {
  /** Current authoritative or optimistic integer count. */
  value: number;
}) {
  const [frame, setFrame] = useState({ current: value, previous: value, revision: 0 });
  // Adjust during rendering so old/new digits enter the DOM in the same frame.
  if (frame.current !== value) {
    setFrame({ current: value, previous: frame.current, revision: frame.revision + 1 });
  }
  return (
    <span className="animated-count">
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="counter-viewport" data-direction={frame.current > frame.previous ? "up" : "down"}>
        {frame.revision > 0 && (
          <span key={`old-${frame.revision}`} className="counter-out">{frame.previous}</span>
        )}
        <span key={frame.revision} className={frame.revision > 0 ? "counter-in" : undefined}>{frame.current}</span>
      </span>
    </span>
  );
}
