import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Consistent sticky route heading with an explicit back destination and optional action. */
export function PageHeader({
  title,
  back,
  action,
}: {
  /** Route title, allowed to truncate visually but preserved for assistive technology. */ title: string;
  /** Parent route, absent for top-level destinations. */ back?: string;
  /** Optional route-specific action. */ action?: ReactNode;
}) {
  return (
    <header className="page-heading route-heading">
      {back ? (
        <Link href={back} className="icon-button" aria-label="Back">
          <Icon name="back" />
        </Link>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <div>{action}</div>
    </header>
  );
}
