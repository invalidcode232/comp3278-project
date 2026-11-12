import { saveImage } from "../src/lib/upload";
import { withImageTransaction } from "../src/lib/image-lifecycle";
import { insertImage, getImage, getVisibleImage } from "../src/lib/queries/images";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { sendMessage, listConversation, listConversations } from "../src/lib/queries/messages";
import { pool } from "../src/lib/db";
import { createSession, renewSession, deleteSession, getSessionUser } from "../src/lib/queries/sessions";

/**
 * Exercise real MySQL boundaries in an explicitly selected disposable database.
 * Fixtures use independent UUIDs and are removed in finally, without a reset.
 */
test("database-backed policy boundaries", async (t) => {
  assert.equal(process.env.RUN_DB_TESTS, "1", "Set RUN_DB_TESTS=1 only for a disposable database");
  const userId = randomUUID();
  const token = randomBytes(32).toString("hex");
  await pool.execute("INSERT INTO users (id, handle, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)",
    [userId, `test_${userId.slice(0,8)}`, `${userId}@example.test`, "x".repeat(60), "Policy test"]);
  try {
    /** Check fresh, due, simultaneous, expired, and revoked session activity. */
    await t.test("session renewal is daily, atomic, and never revives expiry", async () => {
      await createSession(pool, token, userId);
      assert.equal(await renewSession(pool, token), false);
      await pool.execute("UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL 29 DAY + INTERVAL 5 SECOND WHERE token = ?", [token]);
      assert.equal(await renewSession(pool, token), false);
      await pool.execute("UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL 29 DAY WHERE token = ?", [token]);
      const outcomes = await Promise.all([renewSession(pool, token), renewSession(pool, token)]);
      assert.equal(outcomes.filter(Boolean).length, 1);
      assert.equal((await getSessionUser(pool, token))?.id, userId);
      await pool.execute("UPDATE sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE token = ?", [token]);
      assert.equal(await renewSession(pool, token), false);
      assert.equal(await getSessionUser(pool, token), null);
      await deleteSession(pool, token);
      assert.equal(await renewSession(pool, token), false);
    });
    /** A self-message is one stored row, one conversation entry, and one sent item. */
    await t.test("self messages appear once and remain in chronological order", async () => {
      const first = await sendMessage(pool, { senderId: userId, recipientId: userId, body: "First note", imageId: null });
      const second = await sendMessage(pool, { senderId: userId, recipientId: userId, body: "Second note", imageId: null });
      const messages = await listConversation(pool, userId, userId);
      assert.deepEqual(messages.map((message) => message.id), [first, second]);
      assert.ok(messages.every((message) => message.sender_id === userId));
      const conversations = await listConversations(pool, userId);
      assert.equal(conversations.length, 1);
      assert.equal(conversations[0].partner_id, userId);
      assert.equal(conversations[0].last_message_id, second);
    });
    /** Exercise visibility changes, shared references, rollback, and concurrent reuse. */
    await t.test("image visibility and cleanup follow live references", async () => {
      const peer = randomUUID();
      await pool.execute("INSERT INTO users (id, handle, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)",
        [peer, `test_${peer.slice(0,8)}`, `${peer}@example.test`, "x".repeat(60), "Peer"]);
      const data = Buffer.from(`private-image-${userId}`);
      const image = { sha256: createHash("sha256").update(data).digest("hex"), mimeType: "image/png", byteSize: data.length, data };
      let imageId = 0;
      try {
        await withImageTransaction(async (conn) => {
          imageId = await insertImage(conn, image);
          await sendMessage(conn, { senderId: userId, recipientId: peer, body: null, imageId });
        });
        assert.equal(await getVisibleImage(pool, imageId, null), null);
        assert.equal(await getVisibleImage(pool, imageId, randomUUID()), null);
        assert.ok(await getVisibleImage(pool, imageId, userId));
        assert.ok(await getVisibleImage(pool, imageId, peer));
        await withImageTransaction(async (conn) => {
          await conn.execute("UPDATE users SET avatar_image_id = ? WHERE id = ?", [imageId, userId]);
        });
        assert.ok(await getVisibleImage(pool, imageId, null), "public avatar makes shared bytes public");
        await withImageTransaction(async (conn) => {
          await conn.execute("UPDATE users SET avatar_image_id = NULL WHERE id = ?", [userId]);
        });
        assert.equal(await getVisibleImage(pool, imageId, null), null, "public access is revoked immediately");
        await assert.rejects(withImageTransaction(async (conn) => {
          await conn.execute("DELETE FROM messages WHERE image_id = ?", [imageId]);
          throw new Error("rollback fixture");
        }), /rollback fixture/);
        assert.ok(await getVisibleImage(pool, imageId, peer), "failed mutation preserves references");
        const ids = await Promise.all([1, 2].map(async () => withImageTransaction(async (conn) => {
          const reused = await insertImage(conn, image);
          await sendMessage(conn, { senderId: userId, recipientId: userId, body: null, imageId: reused });
          return reused;
        })));
        assert.deepEqual(ids, [imageId, imageId]);
        await withImageTransaction(async (conn) => {
          await conn.execute("DELETE FROM users WHERE id = ?", [peer]);
        });
        assert.ok(await getImage(pool, imageId), "self-message references survive peer deletion");
        await withImageTransaction(async (conn) => {
          await conn.execute("DELETE FROM messages WHERE image_id = ?", [imageId]);
        });
        assert.equal(await getImage(pool, imageId), null, "last reference deletion removes bytes immediately");
      } finally {
        await withImageTransaction(async (conn) => { await conn.execute("DELETE FROM users WHERE id = ?", [peer]); });
      }
    });
    /** Both upload validation and the database accept exactly 10 MiB, not one byte more. */
    await t.test("image byte boundary and shared cleanup", async () => {
      const bytes = Buffer.alloc(10 * 1024 * 1024);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
      const file = new File([bytes], "boundary.png", { type: "image/png" });
      let imageId = 0;
      await withImageTransaction(async (conn) => {
        imageId = await saveImage(conn, file);
        await sendMessage(conn, { senderId: userId, recipientId: userId, body: null, imageId });
      });
      assert.equal((await getImage(pool, imageId))?.data.length, bytes.length);
      await assert.rejects(withImageTransaction(async (conn) => {
        await saveImage(conn, new File([Buffer.concat([bytes, Buffer.from([0])])], "large.png"));
      }), /10 MiB/);
      await assert.rejects(withImageTransaction(async (conn) => {
        const oversized = Buffer.concat([bytes, Buffer.from([1])]);
        await insertImage(conn, { sha256: createHash("sha256").update(oversized).digest("hex"), mimeType: "image/png", byteSize: oversized.length, data: oversized });
      }), /chk_images_size/);
      await assert.rejects(withImageTransaction(async (conn) => {
        await saveImage(conn, new File(["not an image"], "fake.png", { type: "image/png" }));
      }), /Only JPEG/);
    });
  } finally {
    await withImageTransaction(async (conn) => { await conn.execute("DELETE FROM users WHERE id = ?", [userId]); });
    await pool.end();
  }
});
