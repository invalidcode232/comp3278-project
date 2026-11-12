"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { follow, unfollow } from "@/lib/queries/follows";
import { getUserByHandle } from "@/lib/queries/users";
import { str } from "@/lib/validate";

/** Resolve the submitted handle to an existing account; the calling action handles self-following.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
async function target(formData: FormData) {
  const user = await getUserByHandle(pool, str(formData, "handle"));
  if (!user) throw new Error("User not found");
  return user;
}

/** Add a following relationship for the authenticated user and refresh page data.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function followAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const user = await target(formData);
  if (user.id !== me.id) await follow(pool, me.id, user.id); // CHECK also blocks self-follow
  revalidatePath("/", "layout");
}

/** Remove a following relationship for the authenticated user and refresh page data.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function unfollowAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const user = await target(formData);
  await unfollow(pool, me.id, user.id);
  revalidatePath("/", "layout");
}
