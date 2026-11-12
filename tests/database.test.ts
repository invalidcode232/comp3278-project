import { findOrCreateTopic, searchTopics } from "../src/lib/queries/topics";
import { validateTopicName } from "../src/lib/topic-name";
import {
  createPost,
  deletePost,
  updatePost,
  getPost,
  listReplies,
  listAncestors,
} from "../src/lib/queries/posts";
import { deleteUser } from "../src/lib/queries/users";
import { setPostLike } from "../src/lib/queries/likes";
import { saveImage } from "../src/lib/upload";
import { withImageTransaction } from "../src/lib/image-lifecycle";
import {
  insertImage,
  getImage,
  getVisibleImage,
} from "../src/lib/queries/images";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  sendMessage,
  listConversation,
  listConversations,
} from "../src/lib/queries/messages";
import { pool } from "../src/lib/db";
import {
  createSession,
  renewSession,
  deleteSession,
  getSessionUser,
} from "../src/lib/queries/sessions";

/**
 * Exercise real MySQL boundaries in an explicitly selected disposable database.
 * Fixtures use independent UUIDs and are removed in finally, without a reset.
 */
test("database-backed policy boundaries", async (t) => {
  assert.equal(
    process.env.RUN_DB_TESTS,
    "1",
    "Set RUN_DB_TESTS=1 only for a disposable database",
  );
  const userId = randomUUID();
  const token = randomBytes(32).toString("hex");
  await pool.execute(
    "INSERT INTO users (id, handle, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)",
    [
      userId,
      `test_${userId.slice(0, 8)}`,
      `${userId}@example.test`,
      "x".repeat(60),
      "Policy test",
    ],
  );
  try {
    /** User-created vocabulary merges equivalent names, searches literal substrings, and rolls back with posts. */
    await t.test(
      "user-created topics: identity, search, validation and rollback",
      async () => {
        const name = `Topic ${randomUUID().slice(0, 8)} 100%_Study`;
        try {
          const ids = await Promise.all([
            findOrCreateTopic(pool, name),
            findOrCreateTopic(pool, name.toUpperCase()),
          ]);
          assert.equal(ids[0], ids[1]);
          assert.equal(
            (await searchTopics(pool, name.slice(6, 13).toUpperCase()))[0]?.id,
            ids[0],
          );
          assert.ok(
            (await searchTopics(pool, "%_Study")).some(
              /** Literal wildcard characters are ordinary label text. */ (
                row,
              ) => row.id === ids[0],
            ),
          );
          assert.equal(validateTopicName("  Study   group  "), "Study group");
          assert.throws(() => validateTopicName(" "));
          assert.throws(() => validateTopicName("a".repeat(51)));
          assert.throws(() => validateTopicName("a\u0000b"));
          assert.equal(validateTopicName("界".repeat(50)).length, 50);
          await assert.rejects(
            withImageTransaction(async (db) => {
              await findOrCreateTopic(db, `${name} rollback`);
              throw new Error("Simulated post failure");
            }),
            /Simulated post failure/,
          );
          assert.equal(
            (await searchTopics(pool, `${name} rollback`)).length,
            0,
          );
        } finally {
          await pool.execute("DELETE FROM topics WHERE name IN (?, ?)", [
            name,
            `${name} rollback`,
          ]);
        }
      },
    );
    /** Check fresh, due, simultaneous, expired, and revoked session activity. */
    await t.test(
      "session renewal is daily, atomic, and never revives expiry",
      async () => {
        await createSession(pool, token, userId);
        assert.equal(await renewSession(pool, token), false);
        await pool.execute(
          "UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL 29 DAY + INTERVAL 5 SECOND WHERE token = ?",
          [token],
        );
        assert.equal(await renewSession(pool, token), false);
        await pool.execute(
          "UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL 29 DAY WHERE token = ?",
          [token],
        );
        const outcomes = await Promise.all([
          renewSession(pool, token),
          renewSession(pool, token),
        ]);
        assert.equal(outcomes.filter(Boolean).length, 1);
        assert.equal((await getSessionUser(pool, token))?.id, userId);
        await pool.execute(
          "UPDATE sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE token = ?",
          [token],
        );
        assert.equal(await renewSession(pool, token), false);
        assert.equal(await getSessionUser(pool, token), null);
        await deleteSession(pool, token);
        assert.equal(await renewSession(pool, token), false);
      },
    );
    /** A self-message is one stored row, one conversation entry, and one sent item. */
    await t.test(
      "self messages appear once and remain in chronological order",
      async () => {
        const first = await sendMessage(pool, {
          senderId: userId,
          recipientId: userId,
          body: "First note",
          imageId: null,
        });
        const second = await sendMessage(pool, {
          senderId: userId,
          recipientId: userId,
          body: "Second note",
          imageId: null,
        });
        const messages = await listConversation(pool, userId, userId);
        assert.deepEqual(
          messages.map((message) => message.id),
          [first, second],
        );
        assert.ok(messages.every((message) => message.sender_id === userId));
        const conversations = await listConversations(pool, userId);
        assert.equal(conversations.length, 1);
        assert.equal(conversations[0].partner_id, userId);
        assert.equal(conversations[0].last_message_id, second);
      },
    );
    /** Exercise visibility changes, shared references, rollback, and concurrent reuse. */
    await t.test(
      "image visibility and cleanup follow live references",
      async () => {
        const peer = randomUUID();
        await pool.execute(
          "INSERT INTO users (id, handle, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)",
          [
            peer,
            `test_${peer.slice(0, 8)}`,
            `${peer}@example.test`,
            "x".repeat(60),
            "Peer",
          ],
        );
        const data = Buffer.from(`private-image-${userId}`);
        const image = {
          sha256: createHash("sha256").update(data).digest("hex"),
          mimeType: "image/png",
          byteSize: data.length,
          data,
        };
        let imageId = 0;
        try {
          await withImageTransaction(async (conn) => {
            imageId = await insertImage(conn, image);
            await sendMessage(conn, {
              senderId: userId,
              recipientId: peer,
              body: null,
              imageId,
            });
          });
          assert.equal(await getVisibleImage(pool, imageId, null), null);
          assert.equal(
            await getVisibleImage(pool, imageId, randomUUID()),
            null,
          );
          assert.ok(await getVisibleImage(pool, imageId, userId));
          assert.ok(await getVisibleImage(pool, imageId, peer));
          await withImageTransaction(async (conn) => {
            await conn.execute(
              "UPDATE users SET avatar_image_id = ? WHERE id = ?",
              [imageId, userId],
            );
          });
          assert.ok(
            await getVisibleImage(pool, imageId, null),
            "public avatar makes shared bytes public",
          );
          await withImageTransaction(async (conn) => {
            await conn.execute(
              "UPDATE users SET avatar_image_id = NULL WHERE id = ?",
              [userId],
            );
          });
          assert.equal(
            await getVisibleImage(pool, imageId, null),
            null,
            "public access is revoked immediately",
          );
          await assert.rejects(
            withImageTransaction(async (conn) => {
              await conn.execute("DELETE FROM messages WHERE image_id = ?", [
                imageId,
              ]);
              throw new Error("rollback fixture");
            }),
            /rollback fixture/,
          );
          assert.ok(
            await getVisibleImage(pool, imageId, peer),
            "failed mutation preserves references",
          );
          const ids = await Promise.all(
            [1, 2].map(async () =>
              withImageTransaction(async (conn) => {
                const reused = await insertImage(conn, image);
                await sendMessage(conn, {
                  senderId: userId,
                  recipientId: userId,
                  body: null,
                  imageId: reused,
                });
                return reused;
              }),
            ),
          );
          assert.deepEqual(ids, [imageId, imageId]);
          await withImageTransaction(async (conn) => {
            await deleteUser(conn, peer);
          });
          assert.ok(
            await getImage(pool, imageId),
            "self-message references survive peer deletion",
          );
          await withImageTransaction(async (conn) => {
            await conn.execute("DELETE FROM messages WHERE image_id = ?", [
              imageId,
            ]);
          });
          assert.equal(
            await getImage(pool, imageId),
            null,
            "last reference deletion removes bytes immediately",
          );
        } finally {
          await withImageTransaction(async (conn) => {
            await deleteUser(conn, peer);
          });
        }
      },
    );
    /** Thread/comment references protect shared bytes until replacement or cascade removes them. */
    await t.test(
      "public content cleanup respects ownership and cascades",
      async () => {
        let threadId = 0;
        let commentId = 0;
        let threadImage = 0;
        let commentImage = 0;
        await withImageTransaction(async (conn) => {
          const bytes = Buffer.from(`thread-image-${userId}`);
          threadImage = await insertImage(conn, {
            sha256: createHash("sha256").update(bytes).digest("hex"),
            mimeType: "image/png",
            byteSize: bytes.length,
            data: bytes,
          });
          const other = Buffer.from(`comment-image-${userId}`);
          commentImage = await insertImage(conn, {
            sha256: createHash("sha256").update(other).digest("hex"),
            mimeType: "image/png",
            byteSize: other.length,
            data: other,
          });
          threadId = await createPost(conn, {
            authorId: userId,
            topicId: 1,
            parentId: null,
            body: null,
            imageId: threadImage,
          });
          commentId = await createPost(conn, {
            authorId: userId,
            parentId: threadId,
            topicId: null,
            body: "Comment",
            imageId: commentImage,
          });
        });
        assert.ok(await getVisibleImage(pool, threadImage, null));
        assert.ok(await getVisibleImage(pool, commentImage, null));
        assert.equal(
          await withImageTransaction((conn) =>
            deletePost(conn, threadId, randomUUID()),
          ),
          false,
        );
        assert.ok(await getImage(pool, threadImage));
        await withImageTransaction((conn) =>
          updatePost(conn, commentId, userId, {
            body: "Text only now",
            imageId: null,
          }),
        );
        assert.equal(await getImage(pool, commentImage), null);
        await withImageTransaction((conn) =>
          deletePost(conn, threadId, userId),
        );
        assert.equal(await getImage(pool, threadImage), null);
      },
    );

    /** Nested replies retain their ancestry after parent and account erasure. */
    await t.test(
      "unified post ancestry, tombstones, constraints and idempotent likes",
      async () => {
        const peer = randomUUID();
        await pool.execute(
          "INSERT INTO users (id,handle,email,password_hash,display_name) VALUES (?,?,?,?,?)",
          [
            peer,
            `peer_${peer.slice(0, 8)}`,
            `${peer}@example.test`,
            "x".repeat(60),
            "Nested peer",
          ],
        );
        try {
          const root = await withImageTransaction((db) =>
            createPost(db, {
              authorId: userId,
              parentId: null,
              topicId: 1,
              body: "Root",
              imageId: null,
            }),
          );
          const reply = await withImageTransaction((db) =>
            createPost(db, {
              authorId: peer,
              parentId: root,
              topicId: null,
              body: "Reply",
              imageId: null,
            }),
          );
          const nested = await withImageTransaction((db) =>
            createPost(db, {
              authorId: userId,
              parentId: reply,
              topicId: null,
              body: "Nested",
              imageId: null,
            }),
          );
          assert.deepEqual(
            (await listAncestors(pool, userId, nested)).map((p) => p.id),
            [root, reply],
          );
          await assert.rejects(
            withImageTransaction((db) =>
              createPost(db, {
                authorId: userId,
                parentId: root,
                topicId: 1,
                body: "Bad topic",
                imageId: null,
              }),
            ),
            /chk_posts_topic/,
          );
          await withImageTransaction(async (db) => {
            await setPostLike(db, userId, reply, true);
            await setPostLike(db, userId, reply, true);
          });
          assert.equal((await getPost(pool, userId, reply))?.like_count, 1);
          await withImageTransaction((db) => deletePost(db, root, userId));
          const deleted = await getPost(pool, userId, root);
          assert.ok(deleted?.deleted_at);
          assert.equal(deleted?.author_id, null);
          assert.equal(deleted?.body, null);
          assert.equal((await listReplies(pool, userId, root))[0].id, reply);
          await withImageTransaction((db) => deleteUser(db, peer));
          assert.equal((await getPost(pool, userId, reply))?.author_id, null);
          assert.equal((await getPost(pool, userId, reply))?.like_count, 0);
          assert.equal((await getPost(pool, userId, nested))?.body, "Nested");
          assert.equal((await listAncestors(pool, userId, nested)).length, 2);
        } finally {
          await withImageTransaction((db) => deleteUser(db, peer));
        }
      },
    );

    /** Both upload validation and the database accept exactly 10 MiB, not one byte more. */
    await t.test("image byte boundary and shared cleanup", async () => {
      const bytes = Buffer.alloc(10 * 1024 * 1024);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
      const file = new File([bytes], "boundary.png", { type: "image/png" });
      let imageId = 0;
      await withImageTransaction(async (conn) => {
        imageId = await saveImage(conn, file);
        await sendMessage(conn, {
          senderId: userId,
          recipientId: userId,
          body: null,
          imageId,
        });
      });
      assert.equal((await getImage(pool, imageId))?.data.length, bytes.length);
      await assert.rejects(
        withImageTransaction(async (conn) => {
          await saveImage(
            conn,
            new File([Buffer.concat([bytes, Buffer.from([0])])], "large.png"),
          );
        }),
        /10 MiB/,
      );
      await assert.rejects(
        withImageTransaction(async (conn) => {
          const oversized = Buffer.concat([bytes, Buffer.from([1])]);
          await insertImage(conn, {
            sha256: createHash("sha256").update(oversized).digest("hex"),
            mimeType: "image/png",
            byteSize: oversized.length,
            data: oversized,
          });
        }),
        /chk_images_size/,
      );
      await assert.rejects(
        withImageTransaction(async (conn) => {
          await saveImage(
            conn,
            new File(["not an image"], "fake.png", { type: "image/png" }),
          );
        }),
        /Only JPEG/,
      );
    });
  } finally {
    await withImageTransaction(async (conn) => {
      await deleteUser(conn, userId);
    });
    await pool.end();
  }
});
