-- =============================================================================
-- COMP3278 Social App — schema
-- Run in one go:  mysql -u root -p < db/schema.sql
-- Engine: InnoDB everywhere (FKs + transactions). Charset: utf8mb4 (emoji-safe).
-- Collation utf8mb4_0900_ai_ci makes UNIQUE(handle) / UNIQUE(email)
-- case-insensitive, so "Alice" and "alice" cannot both exist.
-- =============================================================================

DROP DATABASE IF EXISTS comp3278_social;
CREATE DATABASE comp3278_social
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE comp3278_social;

-- -----------------------------------------------------------------------------
-- images: content-addressed BLOB store. A file is identified by its SHA-256,
-- so uploading the same bytes twice reuses one row (INSERT ... ON DUPLICATE KEY).
-- Images have no owner: one row may be shared by many users/threads/messages,
-- so deleting a user or thread never deletes an image row.
-- -----------------------------------------------------------------------------
CREATE TABLE images (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sha256      CHAR(64) CHARACTER SET ascii NOT NULL,
  mime_type   VARCHAR(32) CHARACTER SET ascii NOT NULL,
  byte_size   INT UNSIGNED NOT NULL,
  data        LONGBLOB NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_images_sha256 (sha256),
  CONSTRAINT chk_images_mime CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif')),
  CONSTRAINT chk_images_size CHECK (byte_size BETWEEN 1 AND 5242880),   -- 5 MB
  -- byte_size is derivable from data. It is stored so lists can show sizes without
  -- reading the BLOB; this CHECK guarantees the stored copy can never disagree.
  CONSTRAINT chk_images_size_matches CHECK (byte_size = LENGTH(data))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- users: id is an internal UUID that never changes; handle is the public,
-- user-editable name used in URLs (/u/[handle]). Keeping them separate means
-- renaming a handle never touches any foreign key.
-- avatar_image_id ON DELETE SET NULL: an avatar is optional, so if an image row
-- were ever removed the user simply falls back to "no avatar".
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id               CHAR(36) CHARACTER SET ascii NOT NULL,
  handle           VARCHAR(30) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    CHAR(60) CHARACTER SET ascii NOT NULL,      -- bcrypt
  display_name     VARCHAR(50) NOT NULL,
  bio              TEXT NULL,
  avatar_image_id  BIGINT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_handle (handle),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_avatar (avatar_image_id),
  CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_image_id)
    REFERENCES images (id) ON DELETE SET NULL,
  CONSTRAINT chk_users_handle CHECK (REGEXP_LIKE(handle, '^[A-Za-z0-9_]{3,30}$')),
  CONSTRAINT chk_users_email CHECK (email LIKE '_%@_%._%'),
  CONSTRAINT chk_users_display_name CHECK (CHAR_LENGTH(TRIM(display_name)) > 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- sessions: one row per logged-in browser. The random token lives in an
-- httpOnly cookie. Activity renews expiry at most daily; expiry minus 30 days
-- is the previous renewal time. CASCADE: deleting a user logs them out everywhere.
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
  token       CHAR(64) CHARACTER SET ascii NOT NULL,           -- 32 random bytes, hex
  user_id     CHAR(36) CHARACTER SET ascii NOT NULL,
  expires_at  DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- topics: fixed list (seeded), visible to everyone.
-- -----------------------------------------------------------------------------
CREATE TABLE topics (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(50) NOT NULL,
  description  VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_topics_name (name),
  CONSTRAINT chk_topics_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- threads: belongs to exactly one author and exactly one topic.
--  author_id  CASCADE  -> deleting a user deletes their threads.
--  topic_id   RESTRICT -> a topic that still has threads cannot be deleted
--                         (threads must always have a topic: NOT NULL).
--  image_id   RESTRICT -> images are shared (dedup) and never deleted by the app.
--                         SET NULL is not an option: it could break the
--                         body-or-image CHECK, and MySQL rejects it anyway
--                         (error 3823: column used in a CHECK cannot have a
--                         SET NULL referential action). Same for comments/messages.
-- chk_threads_content: text that is only spaces does not count as content.
-- chk_threads_edit_time: updated_at can never be earlier than created_at.
-- (topic_id, created_at) serves "threads in topic X, newest first".
-- -----------------------------------------------------------------------------
CREATE TABLE threads (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id   CHAR(36) CHARACTER SET ascii NOT NULL,
  topic_id    INT UNSIGNED NOT NULL,
  body        TEXT NULL,
  image_id    BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_threads_author_created (author_id, created_at),
  KEY idx_threads_topic_created (topic_id, created_at),
  KEY idx_threads_image (image_id),
  KEY idx_threads_created (created_at),
  CONSTRAINT fk_threads_author FOREIGN KEY (author_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_threads_topic FOREIGN KEY (topic_id)
    REFERENCES topics (id) ON DELETE RESTRICT,
  CONSTRAINT fk_threads_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE RESTRICT,
  CONSTRAINT chk_threads_content
    CHECK ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) > 0) OR image_id IS NOT NULL),
  CONSTRAINT chk_threads_edit_time CHECK (updated_at >= created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- comments: CASCADE from the thread (a deleted thread takes its comments) and
-- from the author (a deleted user takes their comments).
-- -----------------------------------------------------------------------------
CREATE TABLE comments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id   BIGINT UNSIGNED NOT NULL,
  author_id   CHAR(36) CHARACTER SET ascii NOT NULL,
  body        TEXT NULL,
  image_id    BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_thread_created (thread_id, created_at),
  KEY idx_comments_author (author_id),
  KEY idx_comments_image (image_id),
  CONSTRAINT fk_comments_thread FOREIGN KEY (thread_id)
    REFERENCES threads (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE RESTRICT,
  CONSTRAINT chk_comments_content
    CHECK ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) > 0) OR image_id IS NOT NULL),
  CONSTRAINT chk_comments_edit_time CHECK (updated_at >= created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Likes: M–N junction tables. The composite PK makes "like twice" impossible,
-- which is what lets the toggle use INSERT IGNORE. Both sides CASCADE: a like
-- disappears with either the user or the liked row.
-- The second index (post id first) serves COUNT(*) per thread/comment.
-- -----------------------------------------------------------------------------
CREATE TABLE thread_likes (
  user_id    CHAR(36) CHARACTER SET ascii NOT NULL,
  thread_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, thread_id),
  KEY idx_thread_likes_thread (thread_id),
  CONSTRAINT fk_thread_likes_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_thread_likes_thread FOREIGN KEY (thread_id)
    REFERENCES threads (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comment_likes (
  user_id     CHAR(36) CHARACTER SET ascii NOT NULL,
  comment_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, comment_id),
  KEY idx_comment_likes_comment (comment_id),
  CONSTRAINT fk_comment_likes_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- follows: self-referencing M–N on users. Counts are COUNT(*) queries, never
-- stored, so they cannot drift. idx_follows_followee serves "who follows X".
-- -----------------------------------------------------------------------------
CREATE TABLE follows (
  follower_id  CHAR(36) CHARACTER SET ascii NOT NULL,
  followee_id  CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  KEY idx_follows_followee (followee_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_followee FOREIGN KEY (followee_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_follows_not_self CHECK (follower_id <> followee_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- collections: a user's named folders of saved threads. UNIQUE(owner_id, name)
-- stops duplicate names per user (and doubles as the owner_id FK index).
-- collection_threads: M–N between collections and threads. CASCADE on both:
-- deleting a collection empties it; deleting a thread removes it from every
-- collection that saved it.
-- -----------------------------------------------------------------------------
CREATE TABLE collections (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id    CHAR(36) CHARACTER SET ascii NOT NULL,
  name        VARCHAR(50) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_collections_owner_name (owner_id, name),
  CONSTRAINT fk_collections_owner FOREIGN KEY (owner_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_collections_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB;

CREATE TABLE collection_threads (
  collection_id  BIGINT UNSIGNED NOT NULL,
  thread_id      BIGINT UNSIGNED NOT NULL,
  saved_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, thread_id),
  KEY idx_collection_threads_thread (thread_id),
  CONSTRAINT fk_ct_collection FOREIGN KEY (collection_id)
    REFERENCES collections (id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_thread FOREIGN KEY (thread_id)
    REFERENCES threads (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- messages: one row per DM. A "conversation" is not a table; it is the set of
-- rows between two users in either direction. Deleting either user CASCADEs
-- the whole conversation away. The two composite indexes serve both
-- directions of "messages between A and B ordered by time".
-- chk_messages_not_self: you cannot message yourself (the conversation-list
-- query in src/lib/queries/messages.ts relies on this).
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id     CHAR(36) CHARACTER SET ascii NOT NULL,
  recipient_id  CHAR(36) CHARACTER SET ascii NOT NULL,
  body          TEXT NULL,
  image_id      BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_pair_created (sender_id, recipient_id, created_at),
  KEY idx_messages_recipient_sender_created (recipient_id, sender_id, created_at),
  KEY idx_messages_image (image_id),
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE RESTRICT,
  CONSTRAINT chk_messages_content
    CHECK ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) > 0) OR image_id IS NOT NULL),
  CONSTRAINT chk_messages_not_self CHECK (sender_id <> recipient_id)
) ENGINE=InnoDB;
