/**
 * npm run db:seed — fills a freshly created schema with demo data.
 * Every user's password is "password123".
 * All inserts are plain parameterized SQL, run in one transaction.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import mysql from "mysql2/promise";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

/** Synthetic demo password hashed separately for each seed account. */
const PASSWORD = "password123";

/** Seed reference time in milliseconds since the Unix epoch. */
const now = Date.now();

/** Convert fixture age in minutes to a Date relative to the seed reference time. */
const minutesAgo =
  /** Convert fixture age in minutes to its synthetic creation Date. */
  (m: number) => new Date(now - m * 60_000);

// ---------------------------------------------------------------- data

/** Synthetic account fixtures keyed by stable symbolic names within this seed run. */
const users = [
  {
    key: "alice",
    name: "Alice Chan",
    bio: "Year 3 CS. Coffee, databases, and bad puns.",
    avatar: "avatar-alice.png",
  },
  {
    key: "bob",
    name: "Bob Lee",
    bio: "Photography club president. Always chasing golden hour.",
    avatar: "avatar-bob.png",
  },
  {
    key: "carol",
    name: "Carol Wong",
    bio: "Food blogger in training. Will review any noodle shop.",
    avatar: "avatar-carol.png",
  },
  {
    key: "dave",
    name: "Dave Patel",
    bio: "Backend dev intern. Ask me about indexes.",
    avatar: null,
  },
  { key: "erin", name: "Erin Ng", bio: null, avatar: null },
  {
    key: "frank",
    name: "Frank Ho",
    bio: "Exchange student, exploring the city one MTR stop at a time.",
    avatar: null,
  },
  {
    key: "grace",
    name: "Grace Lam",
    bio: "Demo account: try deleting me from Settings.",
    avatar: null,
  },
] as const;
/** Allowed symbolic seed-user keys used to resolve fixture references. */
type UserKey = (typeof users)[number]["key"];

/** Seeded public topic choices and descriptions. */
const topics = [
  {
    name: "Course Help",
    description: "Questions and tips about assignments, labs and exams.",
  },
  {
    name: "Campus Life",
    description: "Events, societies, halls and everything else on campus.",
  },
  {
    name: "Tech & Coding",
    description: "Programming, tools, side projects and career talk.",
  },
  { name: "Food", description: "Where to eat on and around campus." },
  {
    name: "Photography",
    description: "Share your shots and ask for feedback.",
  },
];

// [author, topic index, body, image file or null, minutes ago, edited?]

/** Synthetic thread fixtures: author, topic, content, image, age, and edit marker. */
const threads: [
  UserKey,
  number,
  string | null,
  string | null,
  number,
  boolean,
][] = [
  [
    "alice",
    0,
    "Does anyone have tips for normalising a schema to 3NF? I keep second-guessing my functional dependencies.",
    null,
    14000,
    false,
  ],
  [
    "dave",
    2,
    "Hot take: learn to read EXPLAIN output before you learn any ORM.",
    null,
    13500,
    true,
  ],
  ["bob", 4, null, "sunset.png", 13000, false],
  [
    "carol",
    3,
    "New ramen place opened near the east gate. Broth is rich, queue is long. 8/10.",
    "noodles.png",
    12000,
    false,
  ],
  [
    "erin",
    1,
    "Is the library open 24h during exam period this year?",
    null,
    11000,
    false,
  ],
  [
    "frank",
    1,
    "First week here as an exchange student. Any must-join societies?",
    null,
    10500,
    false,
  ],
  [
    "alice",
    2,
    "Built my first Next.js app with raw SQL instead of an ORM. Surprisingly pleasant.",
    null,
    9800,
    true,
  ],
  [
    "bob",
    4,
    "Took this on the hike last weekend. Thoughts on the composition?",
    "mountains.jpg",
    9000,
    false,
  ],
  [
    "dave",
    0,
    "Reminder: COMP3278 assignment deadline is next Friday. Start the ER diagram early!",
    "notes.gif",
    8500,
    false,
  ],
  [
    "carol",
    3,
    "Ranking the canteens on campus, from best to worst. Fight me.",
    null,
    8000,
    false,
  ],
  [
    "erin",
    4,
    "City lights from the rooftop last night.",
    "city-night.png",
    7000,
    false,
  ],
  [
    "frank",
    3,
    "Where can I find good vegetarian food near campus?",
    null,
    6500,
    false,
  ],
  [
    "alice",
    1,
    "The hall formal dinner is on the 20th. Who's going?",
    null,
    6000,
    false,
  ],
  [
    "dave",
    2,
    "Why does my LEFT JOIN return more rows than the left table? (Answer: duplicates on the right side.)",
    null,
    5000,
    false,
  ],
  [
    "bob",
    1,
    "Photography club is running a free workshop this Saturday at 2pm.",
    null,
    4200,
    false,
  ],
  [
    "carol",
    0,
    "Study group for the database exam? Thinking Tuesdays in the library.",
    null,
    3500,
    false,
  ],
  ["grace", 1, "Hello everyone! Just joined.", null, 3000, false],
  [
    "erin",
    2,
    "Which is better for a course project: MySQL or PostgreSQL? Asking for a friend.",
    null,
    2000,
    false,
  ],
  [
    "frank",
    4,
    "Same sunset, different day. Reusing Bob's photo to test image dedup.",
    "sunset.png",
    900,
    false,
  ],
  [
    "alice",
    0,
    "Finally understood window functions. ROW_NUMBER() OVER (PARTITION BY ...) is magic.",
    null,
    300,
    false,
  ],
];

// [thread index, author, body, image file or null]

/** Synthetic comment fixtures referencing seeded threads and users. */
const comments: [number, UserKey, string | null, string | null][] = [
  [
    0,
    "dave",
    "Write down every FD first, then check each one's left side is a superkey.",
    null,
  ],
  [
    0,
    "carol",
    "The lecture notes example with the course table helped me a lot.",
    null,
  ],
  [0, "alice", "Thanks both, that clicked!", null],
  [1, "alice", "Agreed. EXPLAIN saved my assignment twice.", null],
  [1, "erin", "What should I look for first in EXPLAIN?", null],
  [
    1,
    "dave",
    "type = ALL on a big table means a full scan. Add an index.",
    null,
  ],
  [2, "carol", "Gorgeous colours!", null],
  [2, "frank", "Where was this taken?", null],
  [2, "bob", "From the pier near Kennedy Town.", null],
  [3, "alice", "Going this weekend, thanks for the tip.", null],
  [3, "frank", "Do they have a vegetarian option?", null],
  [3, "carol", "Yes, a mushroom broth. Pretty good actually.", null],
  [4, "dave", "Yes, 24h from next Monday.", null],
  [4, "erin", "Perfect, thank you!", null],
  [5, "bob", "Photography club, obviously.", null],
  [5, "alice", "The hiking society does great weekend trips.", null],
  [5, "grace", "Following this thread, I'm new too.", null],
  [6, "dave", "Parameterized queries everywhere I hope?", null],
  [6, "alice", "Every single one. No string concatenation.", null],
  [7, "erin", "Rule of thirds works really well here.", null],
  [7, "carol", "The snow line is lovely.", null],
  [8, "frank", "Is the ER diagram worth many marks?", null],
  [8, "dave", "Check the marking scheme, but yes.", null],
  [9, "frank", "Bold of you to put the main canteen last.", null],
  [9, "carol", "I stand by it.", null],
  [9, "bob", "Here's what I had there today.", "noodles.png"],
  [10, "bob", "Great long exposure.", null],
  [10, "alice", "Which rooftop is this?", null],
  [11, "carol", "Try the Indian place on the main road.", null],
  [
    11,
    "erin",
    "The canteen in the student union has a veggie counter too.",
    null,
  ],
  [12, "carol", "I'm in!", null],
  [12, "erin", "Me too.", null],
  [13, "alice", "This exact bug cost me an hour last week.", null],
  [14, "frank", "Can beginners join?", null],
  [14, "bob", "Absolutely, bring any camera.", null],
  [15, "alice", "Count me in for Tuesdays.", null],
  [15, "dave", "I can help with the SQL questions.", null],
  [17, "dave", "Either works. Use whatever your course uses.", null],
  [18, "bob", "Ha, nice test.", null],
  [19, "dave", "Wait until you meet LAG() and LEAD().", null],
];

/** Synthetic directed follower/followee pairs. */
const follows: [UserKey, UserKey][] = [
  ["alice", "bob"],
  ["alice", "carol"],
  ["alice", "dave"],
  ["bob", "alice"],
  ["bob", "carol"],
  ["carol", "alice"],
  ["carol", "bob"],
  ["carol", "frank"],
  ["dave", "alice"],
  ["erin", "alice"],
  ["erin", "bob"],
  ["erin", "dave"],
  ["frank", "bob"],
  ["frank", "carol"],
  ["grace", "alice"],
];

// [owner, name, thread indexes]

/** Synthetic private collections with their saved-thread fixture indices. */
const collections: [UserKey, string, number[]][] = [
  ["alice", "Exam prep", [0, 8, 13, 15, 19]],
  ["alice", "Food spots", [3, 9, 11]],
  ["bob", "Nice photos", [2, 7, 10, 18]],
];

// [sender, recipient, body, image file or null] — oldest first

/** Synthetic sender/recipient message fixtures with optional images. */
const messages: [UserKey, UserKey, string | null, string | null][] = [
  ["alice", "bob", "Hey Bob, are you free for the workshop on Saturday?", null],
  ["bob", "alice", "Yes! Bring your camera.", null],
  ["alice", "bob", "I only have my phone.", null],
  [
    "bob",
    "alice",
    "That works too. Here's the kind of shot we'll practise.",
    "city-night.png",
  ],
  ["alice", "bob", "Looks great, see you there.", null],
  ["carol", "alice", "Ramen this Friday?", null],
  ["alice", "carol", "Only if we go to the new place.", null],
  ["carol", "alice", "Deal.", null],
  ["dave", "bob", "Can I borrow your tripod?", null],
  ["bob", "dave", "Sure, pick it up at the club room.", null],
  ["dave", "bob", "Thanks!", null],
  ["erin", "alice", "Can you share your 3NF notes?", null],
  ["alice", "erin", "Here's a photo of the page.", "notes.gif"],
  ["frank", "carol", "Thanks for the veggie tip!", null],
  ["carol", "frank", "Anytime. Let me know how it was.", null],
];

// ---------------------------------------------------------------- helpers

/** Supported fixture filename extensions mapped to actual media types. */
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Load a bundled fixture image, hash its bytes, and reuse or insert its BLOB within the seed transaction.
 * @param conn Active MySQL connection owned by the caller.
 * @param file Uploaded File, or bundled fixture filename in the seed script.
 */
async function insertImage(
  conn: PoolConnection,
  file: string,
): Promise<number> {
  const data = await readFile(
    new URL(`../db/seed-images/${file}`, import.meta.url),
  );
  const sha256 = createHash("sha256").update(data).digest("hex");
  const mime = MIME[file.split(".").pop()!.toLowerCase()];
  // Same dedup statement the app uses: an existing hash returns the existing id.
  const [r] = await conn.execute<ResultSetHeader>(
    `INSERT INTO images (sha256, mime_type, byte_size, data)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [sha256, mime, data.length, data],
  );
  return r.insertId;
}

/** Populate an empty database with synthetic demo records in one transaction; roll back on failure. */
async function main(): Promise<void> {
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "comp3278_social",
    timezone: "Z",
    connectionLimit: 1,
  });
  const conn = await pool.getConnection();
  try {
    await conn.query("SET time_zone = '+00:00'");
    const [existing] = await conn.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM users",
    );
    if (Number(existing[0].n) > 0) {
      throw new Error(
        "The database already has users. Run `npm run db:reset` to recreate it from scratch.",
      );
    }

    await conn.beginTransaction();

    // Users ---------------------------------------------------------------
    const userId = new Map<UserKey, string>();
    for (const [i, u] of users.entries()) {
      const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
      userId.set(u.key, id);
      const avatarId = u.avatar ? await insertImage(conn, u.avatar) : null;
      await conn.execute(
        `INSERT INTO users (id, handle, email, password_hash, display_name, bio, avatar_image_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          u.key,
          `${u.key}@example.com`,
          await hash(PASSWORD, 10),
          u.name,
          u.bio,
          avatarId,
          minutesAgo(20000 - i * 100),
        ],
      );
    }
    const uid =
      /** Resolve a known seed-user key to its generated UUID. */
      (k: UserKey) => userId.get(k)!;

    // Topics --------------------------------------------------------------
    const topicIds: number[] = [];
    for (const t of topics) {
      const [r] = await conn.execute<ResultSetHeader>(
        "INSERT INTO topics (name, description) VALUES (?, ?)",
        [t.name, t.description],
      );
      topicIds.push(r.insertId);
    }

    // Threads -------------------------------------------------------------
    const threadIds: number[] = [];
    const threadTimes: number[] = [];
    for (const [author, topic, body, image, ago, edited] of threads) {
      const imageId = image ? await insertImage(conn, image) : null;
      const created = minutesAgo(ago);
      const updated = edited ? minutesAgo(ago - 15) : created;
      const [r] = await conn.execute<ResultSetHeader>(
        `INSERT INTO threads (author_id, topic_id, body, image_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uid(author), topicIds[topic], body, imageId, created, updated],
      );
      threadIds.push(r.insertId);
      threadTimes.push(ago);
    }

    // Comments ------------------------------------------------------------
    const commentIds: number[] = [];
    const perThread = new Map<number, number>();
    for (const [ti, author, body, image] of comments) {
      const n = (perThread.get(ti) ?? 0) + 1;
      perThread.set(ti, n);
      const ago = Math.max(1, threadTimes[ti] - n * 20);
      const created = minutesAgo(ago);
      const imageId = image ? await insertImage(conn, image) : null;
      const edited = commentIds.length % 9 === 4; // a few edited comments
      const [r] = await conn.execute<ResultSetHeader>(
        `INSERT INTO comments (thread_id, author_id, body, image_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          threadIds[ti],
          uid(author),
          body,
          imageId,
          created,
          edited ? minutesAgo(Math.max(0, ago - 5)) : created,
        ],
      );
      commentIds.push(r.insertId);
    }

    // Likes: a deterministic spread so counts differ between posts ----------
    let threadLikes = 0;
    for (const [ti, t] of threads.entries()) {
      for (const [ui, u] of users.entries()) {
        if (u.key !== t[0] && (ti * 3 + ui * 5) % 7 < 4) {
          await conn.execute(
            "INSERT INTO thread_likes (user_id, thread_id) VALUES (?, ?)",
            [uid(u.key), threadIds[ti]],
          );
          threadLikes++;
        }
      }
    }
    let commentLikes = 0;
    for (const [ci, c] of comments.entries()) {
      for (const [ui, u] of users.entries()) {
        if (u.key !== c[1] && (ci * 2 + ui * 3) % 9 < 2) {
          await conn.execute(
            "INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)",
            [uid(u.key), commentIds[ci]],
          );
          commentLikes++;
        }
      }
    }

    // Follows -------------------------------------------------------------
    for (const [a, b] of follows) {
      await conn.execute(
        "INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)",
        [uid(a), uid(b)],
      );
    }

    // Collections ---------------------------------------------------------
    for (const [owner, name, items] of collections) {
      const [r] = await conn.execute<ResultSetHeader>(
        "INSERT INTO collections (owner_id, name, created_at) VALUES (?, ?, ?)",
        [uid(owner), name, minutesAgo(1000)],
      );
      for (const [k, ti] of items.entries()) {
        await conn.execute(
          "INSERT INTO collection_threads (collection_id, thread_id, saved_at) VALUES (?, ?, ?)",
          [r.insertId, threadIds[ti], minutesAgo(900 - k * 30)],
        );
      }
    }

    // Messages ------------------------------------------------------------
    for (const [i, [from, to, body, image]] of messages.entries()) {
      const imageId = image ? await insertImage(conn, image) : null;
      await conn.execute(
        `INSERT INTO messages (sender_id, recipient_id, body, image_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uid(from), uid(to), body, imageId, minutesAgo(600 - i * 30)],
      );
    }

    await conn.commit();

    const [counts] = await conn.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM topics) topics,
              (SELECT COUNT(*) FROM threads) threads, (SELECT COUNT(*) FROM comments) comments,
              (SELECT COUNT(*) FROM thread_likes) thread_likes, (SELECT COUNT(*) FROM comment_likes) comment_likes,
              (SELECT COUNT(*) FROM follows) follows, (SELECT COUNT(*) FROM collections) collections,
              (SELECT COUNT(*) FROM collection_threads) collection_threads, (SELECT COUNT(*) FROM messages) messages,
              (SELECT COUNT(*) FROM images) images`,
    );
    const imageRefs =
      users.filter(
        /** Count seed users that carry an avatar reference. */
        (u) => u.avatar,
      ).length +
      threads.filter(
        /** Count thread fixtures with image filenames. */
        (t) => t[3],
      ).length +
      comments.filter(
        /** Count comment fixtures with image filenames. */
        (c) => c[3],
      ).length +
      messages.filter(
        /** Count message fixtures with image filenames. */
        (m) => m[3],
      ).length;
    console.log("Seeded:", counts[0]);
    console.log(
      `Images: ${imageRefs} references stored as ${counts[0].images} rows (duplicates reused by SHA-256).`,
    );
    console.log(
      `Likes inserted: ${threadLikes} thread, ${commentLikes} comment.`,
    );
    console.log(
      `Demo logins: ${users
        .map(
          /** List synthetic sign-in emails for the seed summary. */
          (u) => `${u.key}@example.com`,
        )
        .join(", ")} / password: ${PASSWORD}`,
    );
  } catch (err) {
    await conn
      .rollback()
      .catch(
        /** Preserve the original seed failure if connection cleanup also fails. */
        () => {},
      );
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(
  /** Report seed failure without connection secrets and exit unsuccessfully. */
  (err: unknown) => {
    console.error("db:seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
