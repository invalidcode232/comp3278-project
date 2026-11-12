"use server";

import { withImageTransaction } from "@/lib/image-lifecycle";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createComment,
  deleteComment,
  getComment,
  updateComment,
} from "@/lib/queries/comments";
import { getUploadedFile, saveImage } from "@/lib/upload";
import {
  errorMessage,
  id,
  InputError,
  optionalText,
  type FormState,
} from "@/lib/validate";

/** Validate text/image content and create a comment with its upload atomically for the authenticated author.
 * @param _prev Previous form feedback required by useActionState; not used for authorization.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function createCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  try {
    const threadId = id(formData.get("thread_id"));
    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    if (!body && !file)
      throw new InputError("A comment needs text, an image, or both.");
    await withImageTransaction(
      /** Create the comment and optional BLOB on the same transaction connection. */
      async (conn) => {
        const imageId = file ? await saveImage(conn, file) : null;
        await createComment(conn, { threadId, authorId: me.id, body, imageId });
      },
    );
  } catch (err) {
    if (isMysqlError(err, "ER_NO_REFERENCED_ROW_2"))
      return { error: "That thread no longer exists." };
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: "Comment posted." };
}

/** Check author ownership and content before atomically replacing a comment’s text/image; redirect to its thread.
 * @param _prev Previous form feedback required by useActionState; not used for authorization.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function updateCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    const commentId = id(formData.get("comment_id"));
    const current = await getComment(pool, commentId);
    if (!current || current.author_id !== me.id)
      throw new InputError("You can only edit your own comments.");
    threadId = current.thread_id;

    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    const removeImage = formData.get("remove_image") === "on";
    if (!body && !file && (removeImage || current.image_id === null)) {
      throw new InputError("A comment needs text, an image, or both.");
    }
    await withImageTransaction(
      /** Replace the comment content and keep its upload/reference changes atomic. */
      async (conn) => {
        const imageId = file
          ? await saveImage(conn, file)
          : removeImage
            ? null
            : current.image_id;
        const ok = await updateComment(conn, commentId, me.id, {
          body,
          imageId,
        });
        if (!ok) throw new InputError("You can only edit your own comments.");
      },
    );
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/threads/${threadId}`);
}

/** Delete only the authenticated author’s comment and refresh affected pages.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function deleteCommentAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await withImageTransaction(
    /** Delete the owned comment before the transaction cleans newly unused images. */
    (conn) => deleteComment(conn, id(formData.get("comment_id")), me.id),
  );
  revalidatePath("/", "layout");
}
