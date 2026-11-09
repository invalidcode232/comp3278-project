import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="muted mt-1">That page doesn&apos;t exist, or it was deleted.</p>
      <Link href="/" className="link mt-3 inline-block">Back to the feed</Link>
    </div>
  );
}
