"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Native disclosure with outside-click/Escape dismissal. Children retain their real link/form semantics. */
export function Menu({
  label,
  trigger,
  children,
  className = "",
}: {
  /** Accessible summary label. */ label: string;
  /** Summary icon or text. */ trigger: ReactNode;
  /** Existing links and forms, not synthetic menu items. */ children: ReactNode;
  /** Placement modifiers such as nav-menu or save-menu. */ className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(
    /** Navigation closes old menus without stealing focus from the destination. */ () => {
      if (ref.current) ref.current.open = false;
    },
    [path],
  );
  useEffect(
    /** Close when clicking elsewhere or Escape; preserve focus for keyboard dismissal. */ () => {
      /** Pointer interactions outside a modal launched by this menu must not hide its owning subtree. */
      function outside(event: PointerEvent) {
        if (ref.current?.querySelector("dialog[open]")) return;
        if (ref.current && !ref.current.contains(event.target as Node))
          ref.current.open = false;
      }
      /** Escape closes the disclosure and returns keyboard focus to its summary. */
      function escape(event: KeyboardEvent) {
        if (
          event.key === "Escape" &&
          ref.current?.open &&
          !ref.current.querySelector("dialog[open]")
        ) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", escape);
      return () => {
        document.removeEventListener("pointerdown", outside);
        document.removeEventListener("keydown", escape);
      };
    },
    [],
  );
  return (
    <details ref={ref} className={`action-menu ${className}`}>
      <summary aria-label={label}>{trigger}</summary>
      <div className="menu-panel">{children}</div>
    </details>
  );
}
