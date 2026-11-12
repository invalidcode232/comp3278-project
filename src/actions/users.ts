"use server";

import { withImageTransaction } from "@/lib/image-lifecycle";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { deleteUser, getUserById, updateProfile } from "@/lib/queries/users";
import { getUploadedFile, saveImage } from "@/lib/upload";
import {
  errorMessage,
  HANDLE_RE,
  optionalText,
  str,
  type FormState,
} from "@/lib/validate";

/** Validate editable profile fields and atomically update the current user’s identity display and avatar. */
export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  const handle = str(formData, "handle");
  const displayName = str(formData, "display_name");
  if (!HANDLE_RE.test(handle))
    return { error: "Handle must be 3–30 letters, digits or underscores." };
  if (displayName.length < 1 || displayName.length > 50)
    return { error: "Display name must be 1–50 characters." };

  try {
    const bio = optionalText(formData, "bio", 500);
    const file = getUploadedFile(formData, "avatar");
    await withImageTransaction(async (conn) => {
      const current = await getUserById(conn, me.id);
      if (!current) throw new Error("User not found");
      let avatarImageId = current.avatar_image_id;
      if (file) avatarImageId = await saveImage(conn, file);
      else if (formData.get("remove_avatar") === "on") avatarImageId = null;
      await updateProfile(conn, me.id, {
        handle,
        displayName,
        bio,
        avatarImageId,
      });
    });
  } catch (err) {
    if (isMysqlError(err, "ER_DUP_ENTRY"))
      return { error: "That handle is taken." };
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

/** Require exact handle confirmation, delete the current account and dependent records, and clear its cookie. */
export async function deleteAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  if (str(formData, "confirm_handle") !== me.handle) {
    return { error: `Type your handle (${me.handle}) exactly to confirm.` };
  }
  // ON DELETE CASCADE removes sessions, threads, comments, likes, follows,
  // collections and messages in the same statement.
  await withImageTransaction((conn) => deleteUser(conn, me.id));
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/");
}
