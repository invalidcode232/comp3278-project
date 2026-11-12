import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Db } from "../db";

/** Latest-message projection for one partner in the viewer’s conversation list. */
export interface ConversationRow {
  /** Internal UUID of the conversation partner. */
  partner_id: string;
  /** Public account handle used in profile URLs. */
  handle: string;
  /** Human-readable account name shown in the UI. */
  display_name: string;
  /** Shared avatar image ID, or null for the initial fallback. */
  avatar_image_id: number | null;
  /** Numeric identifier of the latest message for this partner. */
  last_message_id: number;
  /** Internal UUID that sent the latest message. */
  last_sender_id: string;
  /** Latest message text, or null for image-only content. */
  last_body: string | null;
  /** Latest message attachment ID, or null. */
  last_image_id: number | null;
  /** UTC timestamp of the latest message. */
  last_created_at: Date;
}

/** Message projection ordered within a conversation; nullable body/image support either content form. */
export interface MessageRow {
  /** Stable identifier used to reference this record. */
  id: number;
  /** Internal UUID of the message sender. */
  sender_id: string;
  /** Optional plain-text content; null means image-only content. */
  body: string | null;
  /** Shared attachment image ID, or null for text-only content. */
  image_id: number | null;
  /** Creation timestamp decoded as a Date from UTC storage. */
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
 * Excluding self-messages from the received branch keeps each message once.
 */
export async function listConversations(
  db: Db,
  userId: string,
): Promise<ConversationRow[]> {
  const [rows] = await db.execute<(ConversationRow & RowDataPacket)[]>(
    `WITH my_messages AS (
       SELECT id, sender_id, body, image_id, created_at, recipient_id AS partner_id
       FROM messages WHERE sender_id = ?
       UNION ALL
       SELECT id, sender_id, body, image_id, created_at, sender_id AS partner_id
       FROM messages WHERE recipient_id = ? AND sender_id <> ?
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
    [userId, userId, userId],
  );
  return rows;
}

/** Every message between two users in either direction, oldest first. */
export async function listConversation(
  db: Db,
  userId: string,
  partnerId: string,
): Promise<MessageRow[]> {
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

/** Insert validated sender/recipient content and return the generated message ID; caller owns the upload transaction. */
export async function sendMessage(
  db: Db,
  m: {
    senderId: string;
    recipientId: string; /** Optional plain-text content; null means image-only content. */
    body:
      | string
      | null; /** Shared image identifier; null uses the no-image presentation. */
    imageId: number | null;
  },
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO messages (sender_id, recipient_id, body, image_id)
     VALUES (?, ?, ?, ?)`,
    [m.senderId, m.recipientId, m.body, m.imageId],
  );
  return result.insertId;
}
