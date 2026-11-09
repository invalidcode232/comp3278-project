"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createComment, deleteComment, getComment, updateComment } from "@/lib/queries/comments";
import { getUploadedFile, saveImage } from "@/lib/upload";
import { errorMessage, id, InputError, optionalText, type FormState } from "@/lib/validate";

export async function createCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  try {
    const threadId = id(formData.get("thread_id"));
    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    if (!body && !file) throw new InputError("A comment needs text, an image, or both.");
    await withTransaction(async (conn) => {
      const imageId = file ? await saveImage(conn, file) : null;
      await createComment(conn, { threadId, authorId: me.id, body, imageId });
    });
  } catch (err) {
    if (isMysqlError(err, "ER_NO_REFERENCED_ROW_2")) return { error: "That thread no longer exists." };
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: "Comment posted." };
}

export async function updateCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    const commentId = id(formData.get("comment_id"));
    const current = await getComment(pool, commentId);
    if (!current || current.author_id !== me.id) throw new InputError("You can only edit your own comments.");
    threadId = current.thread_id;

    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    const removeImage = formData.get("remove_image") === "on";
    if (!body && !file && (removeImage || current.image_id === null)) {
      throw new InputError("A comment needs text, an image, or both.");
    }
    await withTransaction(async (conn) => {
      const imageId = file ? await saveImage(conn, file) : removeImage ? null : current.image_id;
      const ok = await updateComment(conn, commentId, me.id, { body, imageId });
      if (!ok) throw new InputError("You can only edit your own comments.");
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/threads/${threadId}`);
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await deleteComment(pool, id(formData.get("comment_id")), me.id);
  revalidatePath("/", "layout");
}
