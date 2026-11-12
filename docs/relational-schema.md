# Relational schema and integrity

The authoritative implementation is `db/schema.sql`. The Chen model and mapping
are in [er-diagram.md](er-diagram.md). There are ten relations.

| Relation | Primary key | Other columns and references |
|---|---|---|
| users | id (UUID) | handle UNIQUE, email UNIQUE, password_hash, display_name, bio, avatar_image_id → images, created_at |
| sessions | token | user_id → users, expires_at |
| images | id | sha256 UNIQUE, mime_type, byte_size, data, created_at |
| topics | id | name UNIQUE, description |
| posts | id | parent_id → posts, author_id → users, topic_id → topics, body, image_id → images, created_at, updated_at, deleted_at |
| post_likes | (user_id, post_id) | References users and posts |
| follows | (follower_id, followee_id) | Both references users; cannot follow self |
| collections | id | owner_id → users, name, created_at; UNIQUE(owner_id, name) |
| collection_posts | (collection_id, post_id) | References collections and posts; saved_at |
| messages | id | sender_id → users, recipient_id → users, body, image_id → images, created_at |

## Roots, replies and erasure

`posts.parent_id IS NULL` identifies a root. A reply references its immediate
parent in the same table, with no separate comment entity or reply-like table.
Only roots store `topic_id`; replies derive topic/context by traversing ancestors.
The database CHECK requires roots to have a topic and replies to have no topic.
Neither parent nor topic can be edited through application mutations. Inserting
only beneath an existing parent, without any reparenting operation, keeps the
application-generated graph acyclic. Direct SQL operators must preserve that
invariant. Recursive CTE traversal uses MySQL's default recursion limit (1,000);
this course application is intended for shallow conversations.

An active post must have an author and nonblank text, an image, or both. A deleted
post must have `deleted_at` and NULL author, body, and image. The row and parent
link remain, even for leaves, so conversation URLs stay stable. Deleted roots are
excluded from feeds; existing descendants remain accessible through their own
URLs and the deleted root's conversation. New replies to a deleted target are
rejected by the server. Replies to surviving descendants remain allowed.

Erasure runs in an image transaction: clear identity/content, remove the target's
likes and saved links, then remove images with no remaining reference. Account
deletion first erases every owned post, then deletes the account; others' replies
survive. Sessions, follows, private collections, remaining likes and messages in
both directions cascade from the account as before.

## Foreign-key deletion behavior

- `posts.parent_id`: RESTRICT, preventing accidental loss or promotion of children.
- `posts.author_id`: RESTRICT; the account-erasure transaction clears it first.
- `posts.topic_id`: RESTRICT, preserving topic identity even on root tombstones.
- Post/message image references: RESTRICT; shared bytes may only be deleted after
  all references disappear. Avatar: SET NULL because it is optional.
- Sessions, follows, collections and likes reference users with CASCADE.
- Message sender and recipient both CASCADE; self-messages are allowed.
- Junction references to posts/collections CASCADE on physical deletion. Normal
  post deletion is erasure, so its junction rows are explicitly removed.

Private collections continue to save **active root posts only**. The server's
INSERT…SELECT enforces ownership, live state and `parent_id IS NULL`; the junction
FK ensures existence. Root-only saving is an application rule, not an extra FK.

## Functional dependencies and normalization

For users, `id`, `handle`, and `email` are candidate keys. For topics, `id` and
`name` are keys; for collections, `id` and `(owner_id,name)` are keys. In posts and
messages, the ID determines the row. Likes and follows are all-key relations.
`(collection_id,post_id)` determines `saved_at`; `token` determines session fields.
Under these domain dependencies the relations satisfy BCNF. Conditional rules
such as root-only topics and tombstone nullability are enforced separately.

Images use the SHA-256 content identity policy: `id` and `sha256` are unique;
identical bytes reuse a row. `byte_size` is derived convenience data protected by
`CHECK(byte_size=LENGTH(data))`. The application computes SHA-256 from validated
bytes; the database does not itself verify that digest. Hash collision handling
is outside the small project's scope.

Counts are derived with independent indexed subqueries, preventing likes × replies
join multiplication. Reply counts count active direct children, not descendants.
The indexes on parent/creation time, author/creation time and topic/creation time
support conversation, profile and feed reads. The likes reverse index supports
counts. DM pair indexes support either message direction.

## Upgrade

`003-unified-posts.sql` preserves root IDs, remaps old comment IDs above the maximum
root ID, merges likes, and copies saved links. `npm run db:migrate` verifies post,
like and saved-link counts before dropping obsolete storage. Old root URLs remain;
old comment fragment IDs are not retained. MySQL DDL is not transactional: stop
the app and take a backup first. On a failed partial migration restore that backup
before retrying. Fresh installations use `db/schema.sql` directly.

### Topic vocabulary

`topics` is shared user-created vocabulary. Its existing unique `name` uses
`utf8mb4_0900_ai_ci` (case/accent insensitive); application normalization trims
and collapses whitespace and normalizes NFC. New rows use an empty description.
The 50-character name limit is retained. A root’s topic ID remains immutable;
replies still store NULL. The topic upsert and post insert share a transaction.
Typing/searching alone writes nothing. There is no topic-owner relationship.
