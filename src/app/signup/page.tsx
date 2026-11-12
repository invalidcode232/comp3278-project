import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/auth";

/** Render registration fields, redirecting already authenticated visitors home. */
export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto max-w-sm card">
      <h1 className="mb-4 text-xl font-semibold">Create an account</h1>
      <ActionForm action={signupAction} submitLabel="Sign up">
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
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="input"
            autoComplete="new-password"
          />
        </div>
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
