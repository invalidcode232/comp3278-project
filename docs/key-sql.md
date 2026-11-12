# Key SQL

The ten most interesting queries in the app. Each is copied from `src/lib/queries/*.ts`, where every query sits inline in a named function. All of them use `?` placeholders: mysql2's `execute()` sends the values separately as a prepared statement, so user input is never pasted into SQL text.

---

## 1. The feed: JOINs, like and comment counts, and "liked by me" (EXISTS)

`src/lib/queries/threads.ts` → `listAllThreads`

```sql
SELECT t.id, t.author_id, t.body, t.image_id, t.created_at,
       (t.updated_at > t.created_at) AS edited,
       u.handle, u.display_name, u.avatar_image_id,
       tp.id AS topic_id, tp.name AS topic_name,
       (SELECT COUNT(*) FROM thread_likes tl WHERE tl.thread_id = t.id) AS like_count,
       (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id)       AS comment_count,
       EXISTS (SELECT 1 FROM thread_likes tl
               WHERE tl.thread_id = t.id AND tl.user_id = ?)          AS liked_by_me
FROM threads t
JOIN users  u  ON u.id  = t.author_id
JOIN topics tp ON tp.id = t.topic_id
ORDER BY t.created_at DESC, t.id DESC
LIMIT 50;
```

Inner JOINs attach the author and topic, since every thread has both. The counts are correlated subqueries, not `LEFT JOIN … GROUP BY`. Joining likes and comments together would produce likes × comments rows per thread and inflate both counts. `EXISTS` stops at the first matching row and returns 1 or 0. When the viewer is logged out, `?` is NULL and the result is always 0. The same SELECT is reused with `WHERE t.topic_id = ?` for a topic page; that filter uses the `(topic_id, created_at)` index.

## 2. "Following" feed: a subquery on the follows junction table

`src/lib/queries/threads.ts` → `listFollowingThreads`

```sql
-- same SELECT ... FROM ... JOIN as above, then:
WHERE t.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = ?)
ORDER BY t.created_at DESC, t.id DESC
LIMIT 50;
```

The subquery lists everyone the viewer follows. The composite PK `(follower_id, followee_id)` serves it directly. MySQL runs `IN (subquery)` as a semi-join, so each thread appears at most once.

## 3. Follower and following counts

`src/lib/queries/follows.ts` → `getFollowCounts`

```sql
SELECT
  (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
  (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following;
```

The counts are computed every time and never stored in a `users.follower_count` column, so they can't drift out of sync. `followers` uses `idx_follows_followee`; `following` uses the primary key, whose leftmost column is `follower_id`.

## 4. Like toggle: INSERT IGNORE, then DELETE

`src/lib/queries/likes.ts` → `toggleThreadLike`

```sql
INSERT IGNORE INTO thread_likes (user_id, thread_id) VALUES (?, ?);
-- if affectedRows = 0 the like already existed, so:
DELETE FROM thread_likes WHERE user_id = ? AND thread_id = ?;
```

The composite PK `(user_id, thread_id)` makes a duplicate like impossible. `INSERT IGNORE` turns the duplicate-key error into a no-op with `affectedRows = 0`. One statement therefore both tries to like and tells us whether the row already existed, with no SELECT first and no race between two quick clicks.

## 5. Image upload with deduplication

`src/lib/queries/images.ts` → `findImageIdByHash`, `insertImage`

```sql
SELECT id FROM images WHERE sha256 = ?;

INSERT INTO images (sha256, mime_type, byte_size, data)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
```

The app computes SHA-256 of the bytes and first looks for an existing row, which saves resending a multi-megabyte BLOB. If none exists it inserts. If two identical uploads race, `UNIQUE(sha256)` fires, and `LAST_INSERT_ID(id)` makes `insertId` return the existing row's id. The seed shows the effect: 12 image references are stored as 8 rows. (A side effect: InnoDB still uses up an AUTO_INCREMENT value on a duplicate, so ids can have gaps.)

## 6. DM conversation list: latest message per partner

`src/lib/queries/messages.ts` → `listConversations`

```sql
WITH my_messages AS (
  SELECT id, sender_id, body, image_id, created_at, recipient_id AS partner_id
  FROM messages WHERE sender_id = ?
  UNION ALL
  SELECT id, sender_id, body, image_id, created_at, sender_id AS partner_id
  FROM messages WHERE recipient_id = ?
),
ranked AS (
  SELECT mm.*,
         ROW_NUMBER() OVER (PARTITION BY partner_id
                            ORDER BY created_at DESC, id DESC) AS rn
  FROM my_messages mm
)
SELECT r.partner_id, u.handle, u.display_name, u.avatar_image_id,
       r.id AS last_message_id, r.sender_id AS last_sender_id,
       r.body AS last_body, r.image_id AS last_image_id,
       r.created_at AS last_created_at
FROM ranked r
JOIN users u ON u.id = r.partner_id
WHERE r.rn = 1
ORDER BY r.created_at DESC, r.id DESC;
```

The first CTE collects every message I sent or received, labelled with the other person. It uses two `UNION ALL` branches rather than `sender_id = ? OR recipient_id = ?`, so each branch can use its own index. The `ROW_NUMBER()` window function numbers each partner's messages from newest to oldest, and `rn = 1` keeps only the latest one per conversation. This needs MySQL 8 (CTEs and window functions).

## 7. Transactional thread creation (image + thread)

`src/actions/threads.ts` → `createThreadAction`, using `withTransaction` from `src/lib/db.ts`

```sql
START TRANSACTION;
  -- only if a file was attached (query 5):
  INSERT INTO images (sha256, mime_type, byte_size, data) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
  INSERT INTO threads (author_id, topic_id, body, image_id) VALUES (?, ?, ?, ?);
COMMIT;   -- or ROLLBACK if either statement fails
```

Both inserts run on one pooled connection between `beginTransaction()` and `commit()`. Suppose the thread insert fails, for example on a bad topic id (`ER_NO_REFERENCED_ROW_2`) or the body-or-image CHECK. Then `rollback()` also undoes the image insert, so no orphan BLOB is left behind. Comments and DMs with images use the same pattern.

## 8. UPDATE with an ownership check

`src/lib/queries/threads.ts` → `updateThread` (`comments.ts` → `updateComment` is the same)

```sql
UPDATE threads
SET body = ?, image_id = ?
WHERE id = ? AND author_id = ?;
```

The logged-in user's id comes from the server-side session, never from the form, and it is part of the WHERE clause. Editing someone else's thread matches 0 rows (`affectedRows = 0`), so there is no gap between "check the owner" and "update". `updated_at` has `ON UPDATE CURRENT_TIMESTAMP`, so it changes automatically, and `updated_at > created_at` drives the "(edited)" marker. Deletes use the same pattern: `DELETE FROM threads WHERE id = ? AND author_id = ?`.

## 9. Save to a collection: INSERT … SELECT as an ownership check

`src/lib/queries/collections.ts` → `addThreadToCollection`, `removeThreadFromCollection`

```sql
INSERT IGNORE INTO collection_threads (collection_id, thread_id)
SELECT c.id, ? FROM collections c
WHERE c.id = ? AND c.owner_id = ?;

DELETE ct FROM collection_threads ct
JOIN collections c ON c.id = ct.collection_id
WHERE ct.collection_id = ? AND ct.thread_id = ? AND c.owner_id = ?;
```

`collection_threads` has no owner column, so ownership has to come from the parent `collections` row. `INSERT … SELECT` produces a row only if the collection belongs to the caller, and `IGNORE` makes saving twice a no-op. The multi-table `DELETE … JOIN` applies the same check when removing.

## 10. Account deletion with ON DELETE CASCADE

`src/lib/queries/users.ts` → `deleteUser`

```sql
DELETE FROM users WHERE id = ?;
```

One statement removes the user and everything they own, because each child table has `ON DELETE CASCADE`. That covers sessions; threads, and through them the comments, likes and collection entries on those threads; the user's own comments and likes; follows in both directions; collections; and messages they sent or received. InnoDB runs the whole cascade as one atomic statement. Tested in the app: deleting `grace` removed her user row, session, thread, comment, 11 thread likes, 9 comment likes and her follow, and left everyone else's data intact.

---

### Bonus: topics with thread counts (LEFT JOIN + GROUP BY)

`src/lib/queries/topics.ts` → `listTopicsWithCounts`

```sql
SELECT tp.id, tp.name, tp.description, COUNT(t.id) AS thread_count
FROM topics tp
LEFT JOIN threads t ON t.topic_id = tp.id
GROUP BY tp.id, tp.name, tp.description
ORDER BY tp.name;
```

`LEFT JOIN` keeps topics with no threads. `COUNT(t.id)` (not `COUNT(*)`) counts 0 for them, because the NULLs from the unmatched join are not counted.

## Sliding sessions

Activity conditionally updates `sessions.expires_at` to UTC now plus 30 days
only if the token has not expired and its current expiry is at most 29 days away.
The expiry minus 30 days represents the previous renewal time, avoiding a
redundant attribute. Concurrent requests compete on the same row: only the
request that changes it refreshes the cookie. Logout deletes the token.
