"use server";

import { revalidatePath } from "next/cache";
import { pool, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendMessage } from "@/lib/queries/messages";
import { getUserByHandle } from "@/lib/queries/users";
import { getUploadedFile, saveImage } from "@/lib/upload";
import { errorMessage, InputError, optionalText, str, type FormState } from "@/lib/validate";

export async function sendMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  try {
    const recipient = await getUserByHandle(pool, str(formData, "to"));
    if (!recipient) throw new InputError("That user does not exist.");
    if (recipient.id === me.id) throw new InputError("You can't message yourself.");
    const body = optionalText(formData, "body");
    const file = getUploadedFile(formData);
    if (!body && !file) throw new InputError("A message needs text, an image, or both.");
    await withTransaction(async (conn) => {
      const imageId = file ? await saveImage(conn, file) : null;
      await sendMessage(conn, { senderId: me.id, recipientId: recipient.id, body, imageId });
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: "Sent." };
}
