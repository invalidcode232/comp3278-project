"use server";

import { withImageTransaction } from "@/lib/image-lifecycle";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createPost,
  deletePost,
  getPost,
  updatePost,
} from "@/lib/queries/posts";
import { getUploadedFile, saveImage } from "@/lib/upload";
import {
  errorMessage,
  id,
  InputError,
  optionalText,
  type FormState,
} from "@/lib/validate";

/** Validate the topic/content and atomically create the authenticated user’s thread and upload; redirect to the new thread.
 * @param _prev Previous form feedback required by useActionState; not used for authorization.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function createPostAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    const parentId = formData.get("parent_id")
      ? id(formData.get("parent_id"))
      : null;
    const topicId = parentId === null ? id(formData.get("topic_id")) : null;
    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    if (!body && !file)
      throw new InputError("A thread needs text, an image, or both.");

    // One transaction: the image row and the thread row are saved together,
    // or neither is (e.g. if the topic id is invalid the image insert is rolled back).
    threadId = await withImageTransaction(
      /** Create the optional BLOB and thread together; return the new thread ID. */
      async (conn) => {
        if (parentId !== null) {
          const parent = await getPost(conn, me.id, parentId);
          if (!parent || parent.deleted_at)
            throw new InputError(
              "That post was deleted. Reply to a surviving post instead.",
            );
        }
        const imageId = file ? await saveImage(conn, file) : null;
        return createPost(conn, {
          authorId: me.id,
          parentId,
          topicId,
          body,
          imageId,
        });
      },
    );
  } catch (err) {
    if (isMysqlError(err, "ER_NO_REFERENCED_ROW_2"))
      return { error: "That topic or parent post no longer exists." };
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/threads/${threadId}`);
}

/** Check author ownership, preserve the topic, and atomically update text/image content; redirect to the thread.
 * @param _prev Previous form feedback required by useActionState; not used for authorization.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function updatePostAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    threadId = id(formData.get("post_id"));
    const current = await getPost(pool, me.id, threadId);
    if (!current || current.deleted_at || current.author_id !== me.id)
      throw new InputError("You can only edit your own posts.");

    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    const removeImage = formData.get("remove_image") === "on";
    if (!body && !file && (removeImage || current.image_id === null)) {
      throw new InputError("A thread needs text, an image, or both.");
    }

    await withImageTransaction(
      /** Replace thread content atomically while preserving ownership and its fixed topic. */
      async (conn) => {
        const imageId = file
          ? await saveImage(conn, file)
          : removeImage
            ? null
            : current.image_id;
        const ok = await updatePost(conn, threadId, me.id, { body, imageId });
        if (!ok) throw new InputError("You can only edit your own posts.");
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

/** Delete only the authenticated author’s post content, preserving descendants, then redirect home.
 * @param formData Submitted fields; caller identity is resolved separately from the session.
 */
export async function deletePostAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await withImageTransaction(
    /** Erase the owned post and remove its saved/like links before image cleanup. */
    (conn) => deletePost(conn, id(formData.get("post_id")), me.id),
  );
  revalidatePath("/", "layout");
  redirect(`/threads/${id(formData.get("post_id"))}`);
}
