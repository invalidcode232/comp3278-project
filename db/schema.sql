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
-- so cleanup deletes a row only after its last reference disappears.
-- The application coordinates reference changes and cleanup in one transaction.
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
  CONSTRAINT chk_images_size CHECK (byte_size BETWEEN 1 AND 10485760),   -- 10 MiB
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
-- topics: shared user-created labels, visible to everyone; seed rows are examples.
-- -----------------------------------------------------------------------------
CREATE TABLE topics (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(50) NOT NULL,
  description  VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_topics_name (name),
  CONSTRAINT chk_topics_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB;

-- posts: root posts and replies share an entity. Roots have a fixed topic and
-- NULL parent; replies have a parent and inherit topic through their ancestors.
-- Author, content, and image are erased on deletion; the tombstone preserves
-- descendants. Self-FK RESTRICT prevents accidental subtree loss. Application
-- inserts only beneath an existing parent and never changes parent_id/topic_id.
CREATE TABLE posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- Stable post/reply key.
  parent_id BIGINT UNSIGNED NULL, -- NULL root, otherwise the immediate parent.
  author_id CHAR(36) CHARACTER SET ascii NULL, -- NULL only on deleted posts.
  topic_id INT UNSIGNED NULL, -- Present only on roots, including deleted roots.
  body TEXT NULL, -- Plain text; image-only active posts are allowed.
  image_id BIGINT UNSIGNED NULL, -- Shared public attachment while active.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL, -- Tombstone timestamp; deletion is irreversible.
  PRIMARY KEY (id),
  KEY idx_posts_parent_created (parent_id, created_at, id),
  KEY idx_posts_author_created (author_id, created_at),
  KEY idx_posts_topic_created (topic_id, created_at),
  KEY idx_posts_image (image_id),
  CONSTRAINT fk_posts_parent FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_image FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE RESTRICT,
  CONSTRAINT chk_posts_topic CHECK (
    (parent_id IS NULL AND topic_id IS NOT NULL) OR
    (parent_id IS NOT NULL AND topic_id IS NULL)),
  CONSTRAINT chk_posts_content CHECK (
    (deleted_at IS NULL AND author_id IS NOT NULL AND
      ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) > 0) OR image_id IS NOT NULL)) OR
    (deleted_at IS NOT NULL AND author_id IS NULL AND body IS NULL AND image_id IS NULL)),
  CONSTRAINT chk_posts_time CHECK (updated_at >= created_at)
) ENGINE=InnoDB;

-- One like per user/post, irrespective of whether the target is a root or reply.
CREATE TABLE post_likes (
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  post_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, post_id),
  KEY idx_post_likes_post (post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
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
-- collection_posts: M–N between collections and threads. CASCADE on both:
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

CREATE TABLE collection_posts (
  collection_id  BIGINT UNSIGNED NOT NULL,
  post_id      BIGINT UNSIGNED NOT NULL,
  saved_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, post_id),
  KEY idx_collection_posts_thread (post_id),
  CONSTRAINT fk_cp_collection FOREIGN KEY (collection_id)
    REFERENCES collections (id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- messages: one row per DM. A "conversation" is not a table; it is the set of
-- rows between two users in either direction. Deleting either user CASCADEs
-- the whole conversation away. The two composite indexes serve both
-- directions of "messages between A and B ordered by time".
-- Self-messaging is allowed: SENDS and RECEIVES may refer to the same user.
-- The conversation-list query excludes self-messages from its received branch.
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
    CHECK ((body IS NOT NULL AND CHAR_LENGTH(TRIM(body)) > 0) OR image_id IS NOT NULL)
) ENGINE=InnoDB;
