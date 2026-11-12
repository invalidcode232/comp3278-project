import { PasswordField } from "@/components/PasswordField";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/auth";

/** Render registration fields, redirecting already authenticated visitors home. */
export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-card card">
      <div className="auth-brand" aria-hidden="true">
        @
      </div>
      <h1 className="mb-2 text-xl font-semibold">Create an account</h1>
      <p className="muted auth-intro">
        Find your people. Start a conversation.
      </p>
      <ActionForm
        buttonClassName="btn auth-submit"
        action={signupAction}
        submitLabel="Sign up"
      >
        <div>
          <label className="label" htmlFor="handle">
            Handle
          </label>
          <input
            id="handle"
            name="handle"
            required
            pattern="[A-Za-z0-9_]{3,30}"
            className="input"
            placeholder="e.g. jane_doe"
          />
          <p className="muted mt-1">
            3–30 letters, digits or underscores. You can change it later.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="display_name">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            required
            maxLength={50}
            className="input"
          />
        </div>
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
        <PasswordField creating />
      </ActionForm>
      <p className="mt-4 muted">
        Already registered?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </div>
  );
}
