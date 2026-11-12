import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Owner-scoped collection summary with its computed saved-thread count. */
export interface CollectionRow {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Human-readable label displayed for this record. */
  name: string;
  /** Creation timestamp decoded as a Date from UTC storage. */
  created_at: Date;
  /** Computed number of associated threads; not a stored counter. */
  thread_count: number;
}

/** The owner's collections with how many threads each holds.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 */
export async function listCollections(
  db: Db,
  ownerId: string,
): Promise<CollectionRow[]> {
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

/** Find a collection only when it belongs to the supplied owner; return null otherwise.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param collectionId Numeric identifier of the target collection.
 */
export async function getCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
): Promise<{
  /** Stable identifier used to reference this record. */
  id: number;

  /** Human-readable label displayed for this record. */
  name: string;
} | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, name FROM collections WHERE id = ? AND owner_id = ?",
    [collectionId, ownerId],
  );
  return rows.length ? { id: rows[0].id, name: rows[0].name } : null;
}

/** For the thread page: each of my collections, and whether this thread is already in it.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param threadId Numeric identifier of the target thread.
 */
export async function listCollectionsForThread(
  db: Db,
  ownerId: string,
  threadId: number,
): Promise<
  {
    /** Stable identifier used to reference this record. */
    id: number;

    /** Human-readable label displayed for this record. */
    name: string;

    /** SQL EXISTS result: 1 when this collection contains the selected thread. */
    has_thread: number;
  }[]
> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.id, c.name,
            EXISTS (SELECT 1 FROM collection_threads ct
                    WHERE ct.collection_id = c.id AND ct.thread_id = ?) AS has_thread
     FROM collections c
     WHERE c.owner_id = ?
     ORDER BY c.name`,
    [threadId, ownerId],
  );
  return rows as {
    /** Stable identifier used to reference this record. */
    id: number;

    /** Human-readable label displayed for this record. */
    name: string;

    /** SQL EXISTS result: 1 when this collection contains the selected thread. */
    has_thread: number;
  }[];
}

/** A duplicate name for the same owner raises ER_DUP_ENTRY on uq_collections_owner_name.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param name Validated collection name, unique for its owner.
 */
export async function createCollection(
  db: Db,
  ownerId: string,
  name: string,
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO collections (owner_id, name) VALUES (?, ?)",
    [ownerId, name],
  );
  return result.insertId;
}

/** Update an owned collection’s name; return whether a row matched and propagate duplicate-name failures.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param collectionId Numeric identifier of the target collection.
 * @param name Validated collection name, unique for its owner.
 */
export async function renameCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
  name: string,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "UPDATE collections SET name = ? WHERE id = ? AND owner_id = ?",
    [name, collectionId, ownerId],
  );
  return result.affectedRows === 1;
}

/** collection_threads rows go with it (ON DELETE CASCADE); the threads themselves stay.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param collectionId Numeric identifier of the target collection.
 */
export async function deleteCollection(
  db: Db,
  ownerId: string,
  collectionId: number,
): Promise<boolean> {
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
 *
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param collectionId Numeric identifier of the target collection.
 * @param threadId Numeric identifier of the target thread.
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

/** Multi-table DELETE: remove the link only if the collection is the caller's.
 * @param db Pool or transaction connection used for all queries in this operation.
 * @param ownerId Authenticated owner UUID used to scope collection access.
 * @param collectionId Numeric identifier of the target collection.
 * @param threadId Numeric identifier of the target thread.
 */
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
