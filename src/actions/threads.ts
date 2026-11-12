"use server";

import { withImageTransaction } from "@/lib/image-lifecycle";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createThread,
  deleteThread,
  getThread,
  updateThread,
} from "@/lib/queries/threads";
import { getUploadedFile, saveImage } from "@/lib/upload";
import {
  errorMessage,
  id,
  InputError,
  optionalText,
  type FormState,
} from "@/lib/validate";

/** Validate the topic/content and atomically create the authenticated user’s thread and upload; redirect to the new thread. */
export async function createThreadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    const topicId = id(formData.get("topic_id"));
    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    if (!body && !file)
      throw new InputError("A thread needs text, an image, or both.");

    // One transaction: the image row and the thread row are saved together,
    // or neither is (e.g. if the topic id is invalid the image insert is rolled back).
    threadId = await withImageTransaction(async (conn) => {
      const imageId = file ? await saveImage(conn, file) : null;
      return createThread(conn, { authorId: me.id, topicId, body, imageId });
    });
  } catch (err) {
    if (isMysqlError(err, "ER_NO_REFERENCED_ROW_2"))
      return { error: "Pick a valid topic." };
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/threads/${threadId}`);
}

/** Check author ownership, preserve the topic, and atomically update text/image content; redirect to the thread. */
export async function updateThreadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  let threadId: number;
  try {
    threadId = id(formData.get("thread_id"));
    const current = await getThread(pool, me.id, threadId);
    if (!current || current.author_id !== me.id)
      throw new InputError("You can only edit your own threads.");

    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    const removeImage = formData.get("remove_image") === "on";
    if (!body && !file && (removeImage || current.image_id === null)) {
      throw new InputError("A thread needs text, an image, or both.");
    }

    await withImageTransaction(async (conn) => {
      const imageId = file
        ? await saveImage(conn, file)
        : removeImage
          ? null
          : current.image_id;
      const ok = await updateThread(conn, threadId, me.id, { body, imageId });
      if (!ok) throw new InputError("You can only edit your own threads.");
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  redirect(`/threads/${threadId}`);
}

/** Delete only the authenticated author’s thread and dependent records, then redirect home. */
export async function deleteThreadAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await withImageTransaction((conn) =>
    deleteThread(conn, id(formData.get("thread_id")), me.id),
  );
  revalidatePath("/", "layout");
  redirect("/");
}
