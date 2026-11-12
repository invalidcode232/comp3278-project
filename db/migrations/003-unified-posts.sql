-- Run once, with the app stopped and a verified backup. Preserves existing data.
-- Apply migrations 001/002 first if upgrading the original teammate baseline.
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
START TRANSACTION;
SET @reply_offset = (SELECT COALESCE(MAX(id),0) FROM threads);
INSERT INTO posts (id,parent_id,author_id,topic_id,body,image_id,created_at,updated_at)
SELECT id,NULL,author_id,topic_id,body,image_id,created_at,updated_at FROM threads;
INSERT INTO posts (id,parent_id,author_id,topic_id,body,image_id,created_at,updated_at)
SELECT id+@reply_offset,thread_id,author_id,NULL,body,image_id,created_at,updated_at FROM comments;
INSERT INTO post_likes SELECT user_id,thread_id FROM thread_likes;
INSERT INTO post_likes SELECT user_id,comment_id+@reply_offset FROM comment_likes;
INSERT INTO collection_posts SELECT collection_id,thread_id,saved_at FROM collection_threads;
COMMIT;
-- Drop obsolete storage only after copying succeeds. Existing /threads/{id}
-- root URLs continue to resolve. Legacy comment anchors receive new numeric IDs.
DROP TABLE comment_likes, thread_likes, collection_threads;
DROP TABLE comments;
DROP TABLE threads;
