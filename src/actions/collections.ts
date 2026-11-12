"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMysqlError, pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  addThreadToCollection,
  createCollection,
  deleteCollection,
  removeThreadFromCollection,
  renameCollection,
} from "@/lib/queries/collections";
import {
  errorMessage,
  id,
  InputError,
  str,
  type FormState,
} from "@/lib/validate";

/** Read and trim a collection name; throw InputError unless it contains 1–50 code units. */
function collectionName(formData: FormData): string {
  const name = str(formData, "name");
  if (name.length < 1 || name.length > 50)
    throw new InputError("Collection names must be 1–50 characters.");
  return name;
}

/** Convert expected collection validation/duplicate-name errors to form feedback; rethrow unexpected failures. */
function handle(err: unknown): FormState {
  if (isMysqlError(err, "ER_DUP_ENTRY"))
    return { error: "You already have a collection with that name." };
  const msg = errorMessage(err);
  if (msg) return { error: msg };
  throw err;
}

/** Create a private collection for the authenticated user and refresh cached pages. */
export async function createCollectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  try {
    await createCollection(pool, me.id, collectionName(formData));
  } catch (err) {
    return handle(err);
  }
  revalidatePath("/", "layout");
  return { ok: "Collection created." };
}

/** Rename only the authenticated user’s collection; return validation or duplicate-name feedback. */
export async function renameCollectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  try {
    const ok = await renameCollection(
      pool,
      me.id,
      id(formData.get("collection_id")),
      collectionName(formData),
    );
    if (!ok) return { error: "Collection not found." };
  } catch (err) {
    return handle(err);
  }
  revalidatePath("/", "layout");
  return { ok: "Renamed." };
}

/** Delete an owned collection and its saved links, preserve threads, and redirect to the collection list. */
export async function deleteCollectionAction(
  formData: FormData,
): Promise<void> {
  const me = await requireUser();
  await deleteCollection(pool, me.id, id(formData.get("collection_id")));
  revalidatePath("/", "layout");
  redirect("/collections");
}

/** Save a thread in an owned collection; repeated saves do not add duplicate links. */
export async function saveToCollectionAction(
  formData: FormData,
): Promise<void> {
  const me = await requireUser();
  await addThreadToCollection(
    pool,
    me.id,
    id(formData.get("collection_id")),
    id(formData.get("thread_id")),
  );
  revalidatePath("/", "layout");
}

/** Remove an owned saved-thread link without deleting the thread. */
export async function removeFromCollectionAction(
  formData: FormData,
): Promise<void> {
  const me = await requireUser();
  await removeThreadFromCollection(
    pool,
    me.id,
    id(formData.get("collection_id")),
    id(formData.get("thread_id")),
  );
  revalidatePath("/", "layout");
}
