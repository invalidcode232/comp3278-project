"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toggleCommentLike, toggleThreadLike } from "@/lib/queries/likes";
import { id } from "@/lib/validate";

/** Toggle the authenticated user’s like on the submitted thread and refresh counts.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function toggleThreadLikeAction(
  formData: FormData,
): Promise<void> {
  const me = await requireUser();
  await toggleThreadLike(pool, me.id, id(formData.get("thread_id")));
  revalidatePath("/", "layout");
}

/** Toggle the authenticated user’s like on the submitted comment and refresh counts.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function toggleCommentLikeAction(
  formData: FormData,
): Promise<void> {
  const me = await requireUser();
  await toggleCommentLike(pool, me.id, id(formData.get("comment_id")));
  revalidatePath("/", "layout");
}
