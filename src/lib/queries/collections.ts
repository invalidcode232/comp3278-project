import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface CollectionRow {
  id: number;
  name: string;
  created_at: Date;
  thread_count: number;
}

/** The owner's collections with how many threads each holds. */
export async function listCollections(db: Db, ownerId: string): Promise<CollectionRow[]> {
  const [rows] = await db.execute<(CollectionRow & RowDataPacket)[]>(
    `SELECT c.id, c.name, c.created_at, COUNT(ct.thread_id) AS thread_count
     FROM collections c
     LEFT JOIN collection_threads ct ON ct.collection_id = c.id
     WHERE c.owner_id = ?
     GROUP BY c.id, c.name, c.created_at
     ORDER BY c.name`,
    [ownerId],
  );
  return rows;
}

export async function getCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
): Promise<{ id: number; name: string } | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, name FROM collections WHERE id = ? AND owner_id = ?",
    [collectionId, ownerId],
  );
  return rows.length ? { id: rows[0].id, name: rows[0].name } : null;
}

/** For the thread page: each of my collections, and whether this thread is already in it. */
export async function listCollectionsForThread(
  db: Db,
  ownerId: string,
  threadId: number,
): Promise<{ id: number; name: string; has_thread: number }[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.id, c.name,
            EXISTS (SELECT 1 FROM collection_threads ct
                    WHERE ct.collection_id = c.id AND ct.thread_id = ?) AS has_thread
     FROM collections c
     WHERE c.owner_id = ?
     ORDER BY c.name`,
    [threadId, ownerId],
  );
  return rows as { id: number; name: string; has_thread: number }[];
}

/** A duplicate name for the same owner raises ER_DUP_ENTRY on uq_collections_owner_name. */
export async function createCollection(db: Db, ownerId: string, name: string): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO collections (owner_id, name) VALUES (?, ?)",
    [ownerId, name],
  );
  return result.insertId;
}

export async function renameCollection(db: Db, ownerId: string, collectionId: number, name: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "UPDATE collections SET name = ? WHERE id = ? AND owner_id = ?",
    [name, collectionId, ownerId],
  );
  return result.affectedRows === 1;
}

/** collection_threads rows go with it (ON DELETE CASCADE); the threads themselves stay. */
export async function deleteCollection(db: Db, ownerId: string, collectionId: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM collections WHERE id = ? AND owner_id = ?",
    [collectionId, ownerId],
  );
  return result.affectedRows === 1;
}

/**
 * Save a thread into a collection. INSERT ... SELECT only produces a row if
 * the collection belongs to the caller, so ownership is checked in the same
 * statement. INSERT IGNORE makes saving twice a no-op.
 */
export async function addThreadToCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
  threadId: number,
): Promise<void> {
  await db.execute(
    `INSERT IGNORE INTO collection_threads (collection_id, thread_id)
     SELECT c.id, ? FROM collections c
     WHERE c.id = ? AND c.owner_id = ?`,
    [threadId, collectionId, ownerId],
  );
}

/** Multi-table DELETE: remove the link only if the collection is the caller's. */
export async function removeThreadFromCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
  threadId: number,
): Promise<void> {
  await db.execute(
    `DELETE ct FROM collection_threads ct
     JOIN collections c ON c.id = ct.collection_id
     WHERE ct.collection_id = ? AND ct.thread_id = ? AND c.owner_id = ?`,
    [collectionId, threadId, ownerId],
  );
}
