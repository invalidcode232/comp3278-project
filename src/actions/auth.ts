"use server";

import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { endSession, startSession } from "@/lib/auth";
import { createUser, findLoginByEmail } from "@/lib/queries/users";
import { HANDLE_RE, str, type FormState } from "@/lib/validate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const handle = str(formData, "handle");
  const email = str(formData, "email").toLowerCase();
  const displayName = str(formData, "display_name");
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  if (!HANDLE_RE.test(handle)) return { error: "Handle must be 3–30 letters, digits or underscores." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { error: "Enter a valid email address." };
  if (displayName.length < 1 || displayName.length > 50) return { error: "Display name must be 1–50 characters." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const id = randomUUID();
  try {
    await createUser(pool, { id, handle, email, passwordHash: await hash(password, 10), displayName });
  } catch (err) {
    if (isMysqlError(err, "ER_DUP_ENTRY")) {
      return { error: err.sqlMessage?.includes("uq_users_handle") ? "That handle is taken." : "That email is already registered." };
    }
    throw err;
  }
  await startSession(id);
  redirect("/");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  const row = await findLoginByEmail(pool, email);
  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!row || !(await compare(password, row.password_hash))) {
    return { error: "Wrong email or password." };
  }
  await startSession(row.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
