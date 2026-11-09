import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

export interface ConversationRow {
  partner_id: string;
  handle: string;
  display_name: string;
  avatar_image_id: number | null;
  last_message_id: number;
  last_sender_id: string;
  last_body: string | null;
  last_image_id: number | null;
  last_created_at: Date;
}

export interface MessageRow {
  id: number;
  sender_id: string;
  body: string | null;
  image_id: number | null;
  created_at: Date;
}

/**
 * Conversation list: the latest message with each partner.
 *  1. my_messages: every message I sent or received, tagged with the other
 *     person (partner_id). Two UNION ALL branches instead of
 *     "sender_id = ? OR recipient_id = ?" so each branch can use its own
 *     index (sender-first and recipient-first).
 *  2. ranked: ROW_NUMBER() restarts at 1 for each partner, newest first.
 *  3. Keep rn = 1 (the latest per partner), join the partner's profile.
 * Messaging yourself is blocked in the app, so no message appears in both branches.
 */
export async function listConversations(db: Db, userId: string): Promise<ConversationRow[]> {
  const [rows] = await db.execute<(ConversationRow & RowDataPacket)[]>(
    `WITH my_messages AS (
       SELECT id, sender_id, body, image_id, created_at, recipient_id AS partner_id
       FROM messages WHERE sender_id = ?
       UNION ALL
       SELECT id, sender_id, body, image_id, created_at, sender_id AS partner_id
       FROM messages WHERE recipient_id = ?
     ),
     ranked AS (
       SELECT mm.*,
              ROW_NUMBER() OVER (PARTITION BY partner_id
                                 ORDER BY created_at DESC, id DESC) AS rn
       FROM my_messages mm
     )
     SELECT r.partner_id, u.handle, u.display_name, u.avatar_image_id,
            r.id AS last_message_id, r.sender_id AS last_sender_id,
            r.body AS last_body, r.image_id AS last_image_id,
            r.created_at AS last_created_at
     FROM ranked r
     JOIN users u ON u.id = r.partner_id
     WHERE r.rn = 1
     ORDER BY r.created_at DESC, r.id DESC`,
    [userId, userId],
  );
  return rows;
}

/** Every message between two users in either direction, oldest first. */
export async function listConversation(db: Db, userId: string, partnerId: string): Promise<MessageRow[]> {
  const [rows] = await db.execute<(MessageRow & RowDataPacket)[]>(
    `SELECT id, sender_id, body, image_id, created_at
     FROM messages
     WHERE (sender_id = ? AND recipient_id = ?)
        OR (sender_id = ? AND recipient_id = ?)
     ORDER BY created_at, id`,
    [userId, partnerId, partnerId, userId],
  );
  return rows;
}

export async function sendMessage(
  db: Db,
  m: { senderId: string; recipientId: string; body: string | null; imageId: number | null },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO messages (sender_id, recipient_id, body, image_id)
     VALUES (?, ?, ?, ?)`,
    [m.senderId, m.recipientId, m.body, m.imageId],
  );
  return result.insertId;
}
