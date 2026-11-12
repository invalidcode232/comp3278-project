import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/auth";

/** Render email/password sign-in, redirecting already authenticated visitors home. */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto max-w-sm card">
      <h1 className="mb-4 text-xl font-semibold">Log in</h1>
      <ActionForm action={loginAction} submitLabel="Log in">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input"
            autoComplete="current-password"
          />
        </div>
      </ActionForm>
      <p className="mt-4 muted">
        No account?{" "}
        <Link href="/signup" className="link">
          Sign up
        </Link>
      </p>
    </div>
  );
}
