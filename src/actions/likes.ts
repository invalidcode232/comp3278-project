"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setPostLike } from "@/lib/queries/likes";
import { withImageTransaction } from "@/lib/image-lifecycle";
import { id } from "@/lib/validate";

/** Persist a desired like state for a root or reply; identity always comes from the session.
 * @param data Target post ID and desired boolean state.
 */
export async function setPostLikeAction(data: FormData): Promise<void> {
  const me = await requireUser();
  await withImageTransaction(
    /** Coordinate likes and post erasure using the same transaction ordering. */
    (db) =>
      setPostLike(
        db,
        me.id,
        id(data.get("post_id")),
        data.get("liked") === "true",
      ),
  );
  revalidatePath("/", "layout");
}
