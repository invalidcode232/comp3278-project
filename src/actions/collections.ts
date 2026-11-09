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
import { errorMessage, id, InputError, str, type FormState } from "@/lib/validate";

function collectionName(formData: FormData): string {
  const name = str(formData, "name");
  if (name.length < 1 || name.length > 50) throw new InputError("Collection names must be 1–50 characters.");
  return name;
}

function handle(err: unknown): FormState {
  if (isMysqlError(err, "ER_DUP_ENTRY")) return { error: "You already have a collection with that name." };
  const msg = errorMessage(err);
  if (msg) return { error: msg };
  throw err;
}

export async function createCollectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  try {
    await createCollection(pool, me.id, collectionName(formData));
  } catch (err) {
    return handle(err);
  }
  revalidatePath("/", "layout");
  return { ok: "Collection created." };
}

export async function renameCollectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  try {
    const ok = await renameCollection(pool, me.id, id(formData.get("collection_id")), collectionName(formData));
    if (!ok) return { error: "Collection not found." };
  } catch (err) {
    return handle(err);
  }
  revalidatePath("/", "layout");
  return { ok: "Renamed." };
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await deleteCollection(pool, me.id, id(formData.get("collection_id")));
  revalidatePath("/", "layout");
  redirect("/collections");
}

export async function saveToCollectionAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await addThreadToCollection(pool, me.id, id(formData.get("collection_id")), id(formData.get("thread_id")));
  revalidatePath("/", "layout");
}

export async function removeFromCollectionAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  await removeThreadFromCollection(pool, me.id, id(formData.get("collection_id")), id(formData.get("thread_id")));
  revalidatePath("/", "layout");
}
