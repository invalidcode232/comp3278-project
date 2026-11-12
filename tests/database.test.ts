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
  } finally {
    await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    await pool.end();
  }
});
