# Relational schema, normalization and integrity constraints

This document goes with the [ER diagram](er-diagram.md) and [`db/schema.sql`](../db/schema.sql). It covers:

1. The relational schema produced from the ER diagram.
2. The functional dependencies of each relation, and a check that every relation is in **BCNF**.
3. Every integrity constraint, grouped by kind.
4. The main design decisions and the alternatives that were rejected.

## 1. Relational schema

Notation: <u>underlined</u> = primary key, *italic* = foreign key (→ the table it references). Each relation lists its candidate keys and where it comes from in the ER diagram.

| Relation | Candidate keys | From the ER diagram |
|---|---|---|
| **users**(<u>id</u>, handle, email, password_hash, display_name, bio, *avatar_image_id* → images, created_at) | {id}, {handle}, {email} | Entity USER; AVATAR becomes the foreign key `avatar_image_id` |
| **sessions**(<u>token</u>, *user_id* → users, expires_at) | {token} | Entity SESSION; HAS_SESSION becomes `user_id` |
| **images**(<u>id</u>, sha256, mime_type, byte_size, data, created_at) | {id}, {sha256}, {data} | Entity IMAGE |
| **topics**(<u>id</u>, name, description) | {id}, {name} | Entity TOPIC |
| **threads**(<u>id</u>, *author_id* → users, *topic_id* → topics, body, *image_id* → images, created_at, updated_at) | {id} | Entity THREAD; WRITES, BELONGS_TO and THREAD_IMAGE become foreign keys |
| **comments**(<u>id</u>, *thread_id* → threads, *author_id* → users, body, *image_id* → images, created_at, updated_at) | {id} | Entity COMMENT; COMMENT_ON, POSTS and COMMENT_IMAGE become foreign keys |
| **collections**(<u>id</u>, *owner_id* → users, name, created_at) | {id}, {owner_id, name} | Entity COLLECTION; OWNS becomes `owner_id` |
| **messages**(<u>id</u>, *sender_id* → users, *recipient_id* → users, body, *image_id* → images, created_at) | {id} | Entity MESSAGE; SENDS, RECEIVES and MESSAGE_IMAGE become foreign keys |
| **thread_likes**(<u>*user_id*, *thread_id*</u>) | {user_id, thread_id} | Many-to-many relationship LIKES_THREAD |
| **comment_likes**(<u>*user_id*, *comment_id*</u>) | {user_id, comment_id} | Many-to-many relationship LIKES_COMMENT |
| **follows**(<u>*follower_id*, *followee_id*</u>) | {follower_id, followee_id} | Recursive many-to-many FOLLOWS. The two columns are named after the roles. |
| **collection_threads**(<u>*collection_id*, *thread_id*</u>, saved_at) | {collection_id, thread_id} | Many-to-many SAVED_IN, plus its attribute `saved_at` |

The reduction follows the standard rules:

- **Strong entity set** → its own relation, keyed by its primary key.
- **One-to-many relationship** → a foreign key on the "many" side. It is `NOT NULL` when that side has total participation (a double line in the diagram) and nullable when participation is partial (AVATAR and the three *_IMAGE relationships).
- **Many-to-many relationship** → its own relation, whose primary key is the union of the two participating keys. The relationship's own attributes (here only `saved_at`) become columns.
- **Derived attributes** (`follower_count`, `following_count`, `like_count`, `comment_count`) are not columns. They are computed with `COUNT(*)` subqueries ([key-sql.md](key-sql.md) §1 and §3).

## 2. Functional dependencies and BCNF

A relation is in **BCNF** if, for every non-trivial functional dependency X → Y that holds in it, X is a superkey. For each relation below, the non-trivial FDs are listed, followed by why the relation is in BCNF.

| Relation | Non-trivial functional dependencies | In BCNF because… |
|---|---|---|
| users | id → handle, email, password_hash, display_name, bio, avatar_image_id, created_at<br>handle → id<br>email → id | Every determinant (id, handle, email) is a candidate key (UNIQUE). |
| sessions | token → user_id, expires_at | token is the key. |
| images | id → sha256, mime_type, byte_size, data, created_at<br>sha256 → id<br>data → sha256, byte_size | id and sha256 are keys. data is also a superkey: it determines sha256, and sha256 determines the whole row. See the note below. |
| topics | id → name, description<br>name → id | Both determinants are keys. |
| threads | id → author_id, topic_id, body, image_id, created_at, updated_at | Only the key determines anything. For example, author_id does **not** determine topic_id. |
| comments | id → thread_id, author_id, body, image_id, created_at, updated_at | As above. Note what is *not* stored: the comment's topic. Storing `topic_id` here would create the transitive dependency id → thread_id → topic_id, which breaks 3NF and BCNF. The topic is reached with a join instead. |
| collections | id → owner_id, name, created_at<br>owner_id, name → id | Both determinants are keys. |
| messages | id → sender_id, recipient_id, body, image_id, created_at | Only the key determines anything. |
| thread_likes, comment_likes, follows | none (all-key relations) | An all-key relation has only trivial FDs, so it is always in BCNF. |
| collection_threads | collection_id, thread_id → saved_at | The determinant is the key. |

**All 12 relations are in BCNF**, and therefore also in 3NF. The schema has no partial or transitive dependencies on non-key attributes, so it has no update, insert or delete anomalies from redundancy.

**Note on `images.byte_size`.** `byte_size` is computable from `data` (it is `LENGTH(data)`). Because `data` is a superkey of `images`, storing it does not break BCNF. It is still derived data, though, and is kept for convenience: the size can be read without loading the BLOB. To remove any risk of inconsistency, `CHECK (byte_size = LENGTH(data))` makes the DBMS reject a row whose stored size disagrees with its data.

**Redundancy that was avoided on purpose:**

| Possible redundant design | Why it was rejected |
|---|---|
| A `follower_count` / `like_count` column, updated on each follow or like | It would duplicate information already in `follows` and `thread_likes`, and drift whenever an update was missed. `COUNT(*)` over an indexed junction table is cheap at this scale. |
| A `conversations` table for DMs | A conversation is completely determined by the pair (sender, recipient). The latest message per partner is derived with a window function ([key-sql.md](key-sql.md) §6), so the table would only add something that can disagree with `messages`. |
| Storing `topic_id` or the thread author on `comments` | Transitive dependencies through `thread_id`, as explained in the table above. |
| A copy of an image per upload | Identical files are stored once, keyed by their SHA-256, and shared by reference. |

## 3. Integrity constraints

| Kind | Where | Constraints |
|---|---|---|
| **Domain** | column types | Fixed-width keys (`CHAR(36)` UUID, `CHAR(64)` token and hash, `CHAR(60)` bcrypt), length limits on `VARCHAR`, `NOT NULL` on every required attribute |
| | CHECK | `chk_users_handle`: 3–30 letters, digits or underscores (`REGEXP_LIKE`)<br>`chk_users_email`: basic `x@y.z` shape<br>`chk_users_display_name`, `chk_topics_name`, `chk_collections_name`: not blank<br>`chk_images_mime`: only jpeg, png, webp or gif<br>`chk_images_size`: 1 byte to 5 MB<br>`chk_images_size_matches`: `byte_size = LENGTH(data)` |
| **Entity / key** | PRIMARY KEY, UNIQUE | One primary key per relation. Candidate keys enforced with UNIQUE: `users.handle`, `users.email`, `images.sha256`, `topics.name`, `collections(owner_id, name)`. Handle and email are unique ignoring case, because the collation is case-insensitive. |
| **Referential** | FOREIGN KEY | 20 foreign keys, each with a chosen `ON DELETE` (see below). There are also 15 CHECK constraints in total. |
| **Semantic (business rules)** | CHECK | `chk_threads_content`, `chk_comments_content`, `chk_messages_content`: a post or message needs non-blank text, an image, or both<br>`chk_threads_edit_time`, `chk_comments_edit_time`: `updated_at >= created_at`<br>`chk_follows_not_self`: you cannot follow yourself<br>`chk_messages_not_self`: you cannot message yourself |

Each of these is tested by a deliberately invalid `INSERT` or `UPDATE` that the DBMS rejects. The app also validates input first, so users get a friendly message, but the database is the final authority.

### Referential actions (`ON DELETE`)

| Foreign key | Action | Reason |
|---|---|---|
| Everything owned by a user (`sessions`, `threads`, `comments`, `collections`, `messages` both ways, likes, follows both ways) | CASCADE | Deleting an account removes everything that only existed because of that user. One `DELETE FROM users` statement does it atomically. |
| `comments.thread_id`, `thread_likes.thread_id`, `collection_threads.thread_id` | CASCADE | A comment, like or saved entry cannot exist without its thread. |
| `comment_likes.comment_id`, `collection_threads.collection_id` | CASCADE | Same reasoning. |
| `threads.topic_id` | RESTRICT | Every thread must have a topic (total participation), so a topic that still has threads cannot be deleted. |
| `threads/comments/messages.image_id` | RESTRICT | Images are shared after deduplication. SET NULL would break the content CHECK, and MySQL also forbids SET NULL on a column used in a CHECK (error 3823). |
| `users.avatar_image_id` | SET NULL | The avatar is optional, so losing it leaves a valid user. |

### Indexes

Every foreign key has an index, as InnoDB requires. Extra composite indexes match the main access paths:

| Index | Serves |
|---|---|
| `threads(topic_id, created_at)` | Threads in a topic, newest first |
| `threads(author_id, created_at)` | A user's threads on their profile |
| `threads(created_at)` | The "All" feed |
| `comments(thread_id, created_at)` | A thread's comments in order |
| `messages(sender_id, recipient_id, created_at)` and `messages(recipient_id, sender_id, created_at)` | A conversation in either direction, and both branches of the conversation-list query |
| `thread_likes(thread_id)`, `comment_likes(comment_id)`, `follows(followee_id)`, `collection_threads(thread_id)` | Lookups from the second column of each junction table (like counts, follower counts, "is this thread saved") |

## 4. Design decisions and alternatives

- **Surrogate keys.** `users.id` (a UUID) is separate from the user-visible `handle`, so renaming a handle is a one-row UPDATE and no foreign key changes. The other entities use `AUTO_INCREMENT` ids. The natural candidate keys are still enforced with UNIQUE.
- **No weak entity sets.** Every entity has its own identifier. COLLECTION was the closest candidate: it could be modelled as a weak entity of USER with discriminator `name`, since `(owner_id, name)` is unique and a collection cannot exist without its owner. That would make `(owner_id, name)` the primary key, which `collection_threads` would then reference. Renaming a collection would then mean updating primary-key values that other tables point to (`ON UPDATE CASCADE`). A surrogate `id` plus `UNIQUE(owner_id, name)` keeps the same uniqueness rule with stable keys.
- **Images as a separate entity.** Storing image data in the `threads`, `comments`, `messages` and `users` rows would duplicate BLOBs and repeat the type and size columns in four tables. One `images` relation referenced by foreign keys keeps each fact in one place and makes deduplication possible.
- **Known trade-offs:**
  - `CHAR(36)` text UUIDs were required by the specification. `BINARY(16)` would use less space and index better, and random UUIDs scatter inserts across the primary-key index.
  - Image rows are never deleted, because they can be shared, so unused images can pile up. Cleaning them up would need reference counting or a periodic sweep: `DELETE FROM images WHERE id NOT IN (…all referencing columns…)`.
