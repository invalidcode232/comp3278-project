# ER diagram

All 12 tables in `db/schema.sql`. GitHub, VS Code (with a Mermaid extension) and <https://mermaid.live> render the diagram below.

```mermaid
erDiagram
    users {
        CHAR(36) id PK "UUID, internal"
        VARCHAR(30) handle UK "public, changeable"
        VARCHAR(255) email UK
        CHAR(60) password_hash "bcrypt"
        VARCHAR(50) display_name
        TEXT bio "NULL"
        BIGINT avatar_image_id FK "NULL -> images.id"
        DATETIME created_at
    }
    sessions {
        CHAR(64) token PK
        CHAR(36) user_id FK
        DATETIME expires_at
    }
    images {
        BIGINT id PK
        CHAR(64) sha256 UK "dedup key"
        VARCHAR(32) mime_type
        INT byte_size
        LONGBLOB data
        DATETIME created_at
    }
    topics {
        INT id PK
        VARCHAR(50) name UK
        VARCHAR(255) description
    }
    threads {
        BIGINT id PK
        CHAR(36) author_id FK
        INT topic_id FK "NOT NULL"
        TEXT body "NULL"
        BIGINT image_id FK "NULL"
        DATETIME created_at
        DATETIME updated_at
    }
    comments {
        BIGINT id PK
        BIGINT thread_id FK
        CHAR(36) author_id FK
        TEXT body "NULL"
        BIGINT image_id FK "NULL"
        DATETIME created_at
        DATETIME updated_at
    }
    thread_likes {
        CHAR(36) user_id PK, FK
        BIGINT thread_id PK, FK
    }
    comment_likes {
        CHAR(36) user_id PK, FK
        BIGINT comment_id PK, FK
    }
    follows {
        CHAR(36) follower_id PK, FK
        CHAR(36) followee_id PK, FK
    }
    collections {
        BIGINT id PK
        CHAR(36) owner_id FK
        VARCHAR(50) name "UNIQUE with owner_id"
        DATETIME created_at
    }
    collection_threads {
        BIGINT collection_id PK, FK
        BIGINT thread_id PK, FK
        DATETIME saved_at
    }
    messages {
        BIGINT id PK
        CHAR(36) sender_id FK
        CHAR(36) recipient_id FK
        TEXT body "NULL"
        BIGINT image_id FK "NULL"
        DATETIME created_at
    }

    users ||--o{ sessions : "has"
    images |o--o{ users : "is avatar of"
    users ||--o{ threads : "writes"
    topics ||--o{ threads : "groups"
    images |o--o{ threads : "attached to"
    threads ||--o{ comments : "has"
    users ||--o{ comments : "writes"
    images |o--o{ comments : "attached to"
    users ||--o{ thread_likes : "gives"
    threads ||--o{ thread_likes : "receives"
    users ||--o{ comment_likes : "gives"
    comments ||--o{ comment_likes : "receives"
    users ||--o{ follows : "follower"
    users ||--o{ follows : "followee"
    users ||--o{ collections : "owns"
    collections ||--o{ collection_threads : "contains"
    threads ||--o{ collection_threads : "saved in"
    users ||--o{ messages : "sends"
    users ||--o{ messages : "receives"
    images |o--o{ messages : "attached to"
```

Notation: `||` exactly one, `|o` zero or one, `o{` zero or more.

## Relationships

### One-to-many (1–N)

| Parent → child | Meaning | ON DELETE |
|---|---|---|
| users → sessions | One user can be logged in on many browsers; each session belongs to one user. | CASCADE: deleting a user logs them out everywhere. |
| users → threads (`author_id`) | A user writes many threads; each thread has exactly one author. | CASCADE |
| topics → threads (`topic_id`, NOT NULL) | A topic groups many threads; each thread is in exactly one topic, chosen when it is created. | RESTRICT: a topic that still has threads cannot be deleted. |
| threads → comments | A thread has many comments; each comment belongs to one thread. | CASCADE: deleting a thread deletes its comments. |
| users → comments (`author_id`) | A user writes many comments. | CASCADE |
| users → collections (`owner_id`) | A user owns many collections. Names are unique per owner: `UNIQUE(owner_id, name)`. | CASCADE |
| users → messages (`sender_id`, `recipient_id`) | Two separate 1–N relationships: a user sends many messages and receives many messages. A conversation is the set of rows between two users, in either direction. | CASCADE on both: a deleted user's conversations disappear. |
| images → users / threads / comments / messages | An image row can be referenced by many rows: uploads are deduplicated by SHA-256, so identical files share one row. Each referencing row has zero or one image (the column is nullable). | Avatar: SET NULL. Threads, comments, messages: RESTRICT. |

The content tables have `CHECK (body IS NOT NULL OR image_id IS NOT NULL)`. MySQL does not allow `ON DELETE SET NULL` on a column used in a CHECK (error 3823), and SET NULL could break the rule anyway. The app never deletes image rows, so RESTRICT is the right choice.

### Many-to-many (M–N) through junction tables

| Junction table | Connects | Composite primary key | Notes |
|---|---|---|---|
| `thread_likes` | users ↔ threads | (user_id, thread_id) | A user likes many threads, and a thread is liked by many users. The PK stops anyone liking a thread twice, which is what makes the `INSERT IGNORE` toggle work. |
| `comment_likes` | users ↔ comments | (user_id, comment_id) | Same as above, for comments. |
| `follows` | users ↔ users (self-referencing) | (follower_id, followee_id) | A user follows many users and is followed by many. `CHECK (follower_id <> followee_id)` blocks following yourself. Follower and following counts are `COUNT(*)` queries, never stored. |
| `collection_threads` | collections ↔ threads | (collection_id, thread_id) | A collection holds many threads, and a thread can be saved in many collections. It has one extra attribute, `saved_at`. |

Every junction table cascades from both sides: a like, follow or saved entry disappears with either of the rows it connects. Each table has a second index that starts with the other column (for example `thread_likes(thread_id)`), so lookups from either side, such as counting the likes on a thread, use an index.

### Identity: `id` vs `handle`

`users.id` is a UUID that never changes, and every foreign key points to it. `handle` is the public name used in URLs (`/u/alice`) and can be edited. Renaming a handle is a single-row UPDATE: no foreign key changes, and old threads still belong to the same user.
