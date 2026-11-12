# Representative SQL

Values are parameterized through `mysql2/promise.execute()`. The examples below
are excerpts; query modules contain the complete projections and contracts.

## One entity, two roles

```sql
-- Roots are feed entries. Replies are read with WHERE parent_id = ?.
SELECT * FROM posts
WHERE parent_id IS NULL AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC LIMIT 50;
```

`posts.ts` shares the same projection for roots, replies, profiles and collections.
LEFT JOIN users keeps erased posts visible even though their author is NULL.
LEFT JOIN topics permits replies without repeating their ancestor's topic.

## Independent counts and viewer state

```sql
SELECT p.id,
  (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS like_count,
  (SELECT COUNT(*) FROM posts r WHERE r.parent_id=p.id AND r.deleted_at IS NULL) AS reply_count,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked_by_me
FROM posts p;
```

Joining likes and replies directly would multiply rows. Independent correlated
subqueries avoid that. Composite keys enforce one like per account/post. The
mutation locks the live target, then inserts/removes the desired relationship;
retries are idempotent, and cannot resurrect a like on an erased post.

## Recursive ancestor context

```sql
WITH RECURSIVE ancestors AS (
  SELECT parent_id AS id, 1 AS depth FROM posts WHERE id=? AND parent_id IS NOT NULL
  UNION ALL
  SELECT p.parent_id,a.depth+1 FROM posts p JOIN ancestors a ON p.id=a.id
  WHERE p.parent_id IS NOT NULL
)
SELECT p.*,a.depth FROM posts p JOIN ancestors a ON a.id=p.id
ORDER BY a.depth DESC;
```

This gives oldest-first context for a focused reply, including deleted placeholders.
The UI does not indent recursively, so deep conversations remain readable on phones.

## Atomic erasure

```sql
UPDATE posts SET body=NULL,image_id=NULL,author_id=NULL,deleted_at=UTC_TIMESTAMP()
WHERE id=? AND author_id=? AND deleted_at IS NULL;
-- Only after an owned row matched:
DELETE FROM post_likes WHERE post_id=?;
DELETE FROM collection_posts WHERE post_id=?;
```

`withImageTransaction` serializes image/reference mutations, performs all writes,
then deletes unreferenced bytes before commit. Account erasure follows the same
pattern for all owned posts before deleting the account. The self-FK uses RESTRICT;
normal erasure never physically removes a post or cascades into other authors' replies.

## Private root saves

```sql
INSERT IGNORE INTO collection_posts(collection_id,post_id)
SELECT c.id,p.id FROM collections c JOIN posts p ON p.id=?
WHERE c.id=? AND c.owner_id=? AND p.parent_id IS NULL AND p.deleted_at IS NULL;
```

Ownership and root/live checks happen in the mutation statement. The composite
key makes duplicate saves harmless. List queries also scope the collection owner.

## Image deduplication and authorization

```sql
INSERT INTO images(sha256,mime_type,byte_size,data) VALUES(?,?,?,?)
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);
```

One image row can be shared by avatars, posts and messages. `getVisibleImage`
requires an avatar/post reference or a DM involving the viewer. Removing the last
public reference immediately restores DM-only access. Authorization precedes ETag
handling; responses use `private, no-store`. Cleanup uses NOT EXISTS against all
three reference sources and shares the mutation transaction and advisory lock.

## Daily session renewal

`renewSession` conditionally updates only a live session whose remaining expiry
is at most 29 days. The resulting expiry is 30 days from current activity. Affected
rows decide whether the response renews the cookie, so simultaneous requests do
not all write or revive an expired session.

## Direct messages

`messages.ts` derives conversations from sender/recipient pairs and uses
ROW_NUMBER() OVER (PARTITION BY partner_id ORDER BY created_at DESC,id DESC)
to select the latest message. Its received branch excludes self-messages, ensuring
a self-message appears once. Messages remain chronological within a conversation;
indexes support both participant directions. Deleting either participant removes
the exchanged messages through foreign keys.

## User-created topic lookup and reuse

```sql
-- Literal substring search: % and _ are not wildcards. The name collation
-- supplies case/accent-insensitive comparison. Values are bound parameters.
SELECT id, name, description FROM topics
WHERE LOCATE(?, name) > 0 OR ? = ''
ORDER BY (name = ?) DESC, name LIMIT 20;

-- Inside the same transaction as the post/image insertion; concurrency is
-- resolved by the unique name key. Preserve the first display spelling.
INSERT INTO topics (name, description) VALUES (?, '')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
```

The driver returns the inserted or existing ID. Failure to create the post rolls
back any new topic. Editing a post never writes its topic ID.
