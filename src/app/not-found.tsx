import Link from "next/link";
import { Icon } from "@/components/Icon";

/** Consistent missing/private-resource page without disclosing whether someone else's record exists. */
export default function NotFound() {
  return (
    <section className="empty-state card missing-page">
      <Icon name="search" />
      <h1>This page isn’t available</h1>
      <p>The link may have changed, or you may not have access to this page.</p>
      <Link href="/" className="btn-secondary">
        Back to home
      </Link>
    </section>
  );
}
