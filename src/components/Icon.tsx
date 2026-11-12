import type { SVGProps } from "react";

/** Supported interface glyphs, drawn consistently with rounded strokes. */
export type IconName =
  | "home"
  | "search"
  | "plus"
  | "heart"
  | "reply"
  | "share"
  | "user"
  | "bookmark"
  | "more"
  | "image"
  | "back"
  | "close"
  | "send";
/** Compact path geometry for the application's navigation and content actions. */
const paths: Record<IconName, string> = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 4v16M4 12h16",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  reply:
    "M21 11.5a9 9 0 0 1-9 9c-1.6 0-3.1-.4-4.4-1.1L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z",
  share: "m3 3 18 9-18 9 4-9-4-9Zm4 9h14",
  user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  bookmark: "M5 3h14v18l-7-5-7 5V3Z",
  more: "M4 12h.01M12 12h.01M20 12h.01",
  image: "M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M16 7h.01",
  back: "m14 5-7 7 7 7M7 12h14",
  close: "m6 6 12 12M6 18 18 6",
  send: "m3 3 18 9-18 9 4-9-4-9Zm4 9h14",
};
/** Render a decorative icon; the owning control supplies its accessible name. */
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & {
  /** Glyph matching the action. */
  name: IconName;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === "more" ? (
        <>
          <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </>
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
