import { PasswordField } from "@/components/PasswordField";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/auth";

/** Render email/password sign-in, redirecting already authenticated visitors home. */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-card card">
      <div className="auth-brand" aria-hidden="true">
        @
      </div>
      <h1 className="mb-2 text-xl font-semibold">Log in</h1>
      <p className="muted auth-intro">Welcome back to your conversations.</p>
      <ActionForm
        buttonClassName="btn auth-submit"
        action={loginAction}
        submitLabel="Log in"
      >
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
        <PasswordField />
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
