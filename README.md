# Threadly

A small social web app: root posts grouped by topic, nested replies, likes, follows, private collections and direct messages, with image uploads stored in MySQL.

- **Stack:** Next.js 16 (App Router, TypeScript) + MySQL 8, using the `mysql2/promise` driver with a connection pool.
- **No ORM or query builder.** Every database operation is hand-written, parameterized SQL in [`src/lib/queries/`](src/lib/queries), one file per entity.
- **Docs:** [ER diagram](docs/er-diagram.md) · [Relational schema & normalization (BCNF)](docs/relational-schema.md) · [Key SQL queries explained](docs/key-sql.md) · [Schema](db/schema.sql)

---

## Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | **22.18 or newer** (24 LTS recommended). The DB scripts are TypeScript files run directly by Node, which needs 22.18+. | `node -v` |
| npm | 10+ (comes with Node) | `npm -v` |
| MySQL | **8.0.16 or newer** (tested on 8.4 LTS). The schema uses CHECK constraints, CTEs and window functions. | `mysql --version` |
| *or* Docker | Docker Desktop / Engine with Compose v2, instead of a local MySQL | `docker compose version` |

## Installation

```bash
git clone https://github.com/invalidcode232/comp3278-project.git comp3278-social
cd comp3278-social
npm ci
cp .env.example .env
```

## Configuration

All settings live in `.env`, which is gitignored. `.env.example` is the template. The npm scripts load the file with `node --env-file=.env`, and Next.js loads it automatically.

| Variable | Example | Meaning |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | MySQL host. Use `127.0.0.1` rather than `localhost`, so the client connects over TCP instead of a Unix socket. |
| `DB_PORT` | `3307` (Docker) / `3306` (local) | MySQL port. `docker-compose.yml` publishes the container on this port; 3307 avoids clashing with a local MySQL on 3306. |
| `DB_USER` | `root` | MySQL user. It needs rights to drop and create the database, since `db:reset` recreates it. |
| `DB_PASSWORD` | `change-me` | Password for `DB_USER`. With Docker, this also becomes the container's root password. |
| `DB_NAME` | `comp3278_social` | Database name. **Keep it as `comp3278_social`**: `db/schema.sql` creates the database under that name, and `db:schema` refuses to run if they differ. |
| `COOKIE_SECURE` | `false` | `true` adds the `Secure` flag to the session cookie. Only set it when the site is served over HTTPS; on plain `http://localhost` the browser would drop the cookie and you could not log in. |

## Database Setup

Choose **one** of the two paths below. Both end with a populated `comp3278_social` database.

### Option A: Docker (no local MySQL needed)

1. Keep the defaults from `.env.example` (`DB_PORT=3307`). Set `DB_PASSWORD` to any value; it becomes the container's root password.
2. Start MySQL 8.4 and wait until it is healthy:

   ```bash
   docker compose up -d
   docker compose ps          # STATUS should show "(healthy)" after ~20–30 s
   ```

3. Create the schema and load the demo data:

   ```bash
   npm run db:reset
   ```

To stop: `docker compose down`. To also delete the data volume: `docker compose down -v`.

### Option B: Local MySQL 8

1. Make sure MySQL 8 is running (`mysqladmin -u root -p ping` → `mysqld is alive`).
2. In `.env`, set `DB_PORT=3306`, plus `DB_USER` and `DB_PASSWORD` for an account that can create databases (usually `root`).
3. Run:

   ```bash
   npm run db:reset
   ```

### What `npm run db:reset` does

| Script | Runs | Effect |
|---|---|---|
| `npm run db:schema` | `scripts/apply-schema.ts` | Runs `db/schema.sql`: `DROP DATABASE IF EXISTS comp3278_social`, `CREATE DATABASE`, then all 10 tables. **Deletes any existing data in that database.** |
| `npm run db:seed` | `scripts/seed.ts` | Inserts the demo data in one transaction. It refuses to run if users already exist. |
| `npm run db:reset` | both, in order | Fresh database with demo data. Deletes existing data; use only for a fresh/disposable setup. |

Expected output (ends with):

```
Created database comp3278_social with 10 tables: collection_posts, collections, follows, images, messages, post_likes, posts, sessions, topics, users
Seeded: { users: 7, topics: 5, roots: 20, replies: 40, post_likes: 120, follows: 15, collections: 3, collection_posts: 12, messages: 15, images: 8 }
Images: 12 references stored as 8 rows (duplicates reused by SHA-256).
```

### Manual fallback (MySQL command-line client)

The schema file runs on its own in one go:

```bash
mysql -u root -p < db/schema.sql
```

With Docker, you don't need a local `mysql` client:

```bash
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/schema.sql
```

Then load the demo data with `npm run db:seed`. The seed is a script rather than a `.sql` file because it bcrypt-hashes the passwords and reads the sample images from `db/seed-images/` as BLOBs with their SHA-256 hashes.

## Seeding & Demo Accounts

Every demo account uses the password **`password123`**.

| Email | Handle | Notes |
|---|---|---|
| `alice@example.com` | `alice` | Has avatar, 2 collections, several DM conversations. Good account to start with. |
| `bob@example.com` | `bob` | Photographer, has avatar and the "Nice photos" collection. |
| `carol@example.com` | `carol` | Has avatar, posts about food. |
| `dave@example.com` | `dave` | No avatar. |
| `erin@example.com` | `erin` | No bio, no avatar. |
| `frank@example.com` | `frank` | His sunset thread reuses Bob's image, which shows deduplication. |
| `grace@example.com` | `grace` | Spare account for trying **Delete account**. |

The seed contains 7 users, 5 topics, 20 roots and 40 replies in one posts table, 120 post likes, 15 follows, 3 collections (12 saved threads), 15 DMs across 5 conversations, and 8 images in PNG, JPEG and GIF. The fixture includes a reply to a reply. Some roots and replies are marked "(edited)". Use `npm run db:reset` only when intentionally discarding all existing data.

## Running

Development, with hot reload:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Both serve <http://localhost:3000>. Log in with any demo account above.

Other scripts: `npm run typecheck` runs `tsc --noEmit`.

### Where each feature is in the UI

| Feature | Where |
|---|---|
| Sign up / log in / log out | `/signup`, `/login`, "Log out" in the account menu |
| Feed: all / following | `/` (tabs "For you" and "Following") |
| Topics and their threads | `/topics` → `/topics/[id]` |
| Create a thread (text and/or image, one topic) | Plus button / inline composer; full-page fallback `/threads/new` |
| Conversation: like, reply to any live post/reply, ancestor context, private root saves | `/threads/[id]` |
| Edit / delete your own thread | "Edit" / "Delete" in your post’s overflow menu; editing is at `/threads/[id]/edit` |
| Profile: bio, avatar, follower/following counts, threads, follow/unfollow | `/u/[handle]` |
| Edit display name, handle, bio, avatar; delete account | `/settings` |
| Collections: create, rename, delete, view | `/collections` → `/collections/[id]` |
| DMs: conversation list and conversation view | `/messages` → `/messages/[handle]` (or "Message" on a profile) |
| Images | `GET /api/images/[id]` |

## Project Structure

```
├── db/
│   ├── schema.sql              # DROP/CREATE DATABASE + all tables; ON DELETE reasoning in comments
│   └── seed-images/            # sample PNG/JPEG/GIF files loaded by the seed
├── scripts/
│   ├── apply-schema.ts         # npm run db:schema
│   └── seed.ts                 # npm run db:seed
├── docs/
│   ├── er-diagram.md           # Chen-notation ER diagram + relationships + mapping to tables
│   ├── er-diagram.svg / .png   # the rendered diagram (PNG for slides)
│   ├── er-diagram.dot          # Graphviz source of the diagram
│   ├── relational-schema.md    # relational schema, functional dependencies, BCNF, constraints
│   └── key-sql.md              # the most interesting queries, explained
├── docker-compose.yml          # MySQL 8.4 on host port ${DB_PORT}
├── .env.example
└── src/
    ├── lib/
    │   ├── db.ts               # mysql2 pool and driver error classification
    │   ├── queries/            # ALL SQL: one file per entity, named functions
    │   │   ├── users.ts  sessions.ts  images.ts  topics.ts  posts.ts
    │   │   └── likes.ts  follows.ts  collections.ts  messages.ts
    │   ├── auth.ts             # session cookie (httpOnly), getCurrentUser(), requireUser()
    │   ├── image-lifecycle.ts  # serialized reference changes and atomic orphan cleanup
    │   ├── upload.ts           # 10 MiB limit, file type from magic bytes, SHA-256, dedup
    │   ├── limits.ts           # upload limits shared with the browser check
    │   ├── validate.ts         # form parsing helpers
    │   └── format.ts
    ├── actions/                # Server Actions: validate input → call queries/*
    ├── components/             # One component per file: PostCard, PostList, ActionForm, Avatar…
    └── app/                    # pages (App Router) + api/images/[id]/route.ts
```

How a request flows: a page (server component) calls `src/lib/queries/*` to read. A form posts to a Server Action in `src/actions/*`, which checks the session, validates input, calls a query function (inside `withImageTransaction` for image/reference changes and cleanup) and revalidates the page.

### Design notes

- **Sessions.** Login creates a row in `sessions` with a 256-bit random token and an expiry 30 days out, and stores the token in an `httpOnly`, `SameSite=Lax` cookie. Every request looks up the token with `expires_at > UTC_TIMESTAMP()`. Authenticated activity renews the expiry and cookie for 30 days, at most once per 24 hours, through `src/proxy.ts`. An expired session cannot renew. Logging out deletes the row.
- **Passwords** are hashed with bcrypt (cost 10) via `bcryptjs`.
- **Images.** The type is detected from the file's first bytes, not trusted from the browser. Both Server Action and proxy body limits allow 12 MB for multipart overhead. Files over 10 MiB are refused, in the browser before upload and again on the server. Images are stored once per SHA-256 and served only after current-reference authorization, with `Cache-Control: private, no-store` and an ETag.
- **Image access and lifecycle.** Avatars and images referenced by live public posts/replies are public. DM-only images require the authenticated sender or recipient. Unknown/inaccessible images both return 404, including conditional requests. Every response uses `private, no-store` because a public image can become private when references change. Previously cached copies from older releases cannot be recalled; this policy governs new responses.
- **Cleanup.** `withImageTransaction` serializes image/reference mutations using a database-scoped advisory lock, then performs the mutation and deletes unreferenced images in one transaction. Cleanup checks avatars, posts, and messages; it includes replacements and post erasure and account deletion. Shared images survive until their last reference disappears. All application image-reference writes must use this helper.
- **Time zone.** All `DATETIME` values are stored in UTC. The pool sets `time_zone = '+00:00'` on every connection, and the server formats times in its local time zone.

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use :::3000`.** Another process is using port 3000. Find it with `lsof -i :3000` and stop it, or run on another port with `npm run dev -- -p 3001` (or `npm start -- -p 3001`).

**`ports are not available` / `port is already allocated` from `docker compose up`.** Something already listens on `DB_PORT`, often a local MySQL on 3306. Keep `DB_PORT=3307` in `.env`, or pick another free port. Check with `lsof -i :3307`.

**`ECONNREFUSED 127.0.0.1:3307` when running `db:reset`.** MySQL isn't up yet. With Docker, wait until `docker compose ps` shows `(healthy)`; the first start takes about 30 seconds. With a local install, check that `DB_PORT` matches your server (`mysql -u root -p -e "SHOW VARIABLES LIKE 'port'"`).

**`Access denied for user 'root'@...`.** `DB_PASSWORD` doesn't match. With Docker, the root password is fixed when the data volume is first created; changing `.env` later has no effect. Use the password used when that volume was created. Only recreate the volume if its data is disposable; back up valued data first.

**Authentication plugin errors** (`ER_NOT_SUPPORTED_AUTH_MODE`, `Client does not support authentication protocol`, `caching_sha2_password could not be loaded`, `Plugin 'mysql_native_password' is not loaded`). MySQL 8 uses `caching_sha2_password` by default, and `mysql2` supports it, so this normally comes from an old account or client.
- If an old account was created with `mysql_native_password` (MySQL 8.4 disables that plugin by default), switch the account to the current plugin:
  ```sql
  ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'your-password';
  ```
- If an older GUI or client can't connect, upgrade it, or connect over TCP with `-h 127.0.0.1`.
- A dedicated app user also works:
  ```sql
  CREATE USER 'comp3278'@'%' IDENTIFIED BY 'secret';
  GRANT ALL PRIVILEGES ON comp3278_social.* TO 'comp3278'@'%';
  ```
  Then set `DB_USER=comp3278` and `DB_PASSWORD=secret`. This user needs `CREATE` and `DROP` rights on `comp3278_social` for `db:reset` to work.

**`ER_NET_PACKET_TOO_LARGE` / `Got a packet bigger than 'max_allowed_packet' bytes` when uploading.** Images go into `LONGBLOB` columns in one INSERT, so `max_allowed_packet` must be larger than the biggest upload (10 MiB). MySQL 8's default is 64 MB, and the Docker service sets `--max-allowed-packet=64M`. If your server has a smaller value:
```sql
SHOW VARIABLES LIKE 'max_allowed_packet';
SET GLOBAL max_allowed_packet = 67108864;   -- 64 MB, lasts until restart
```
To make it permanent, add `max_allowed_packet=64M` under `[mysqld]` in `my.cnf` and restart MySQL.

**`Images must be 10 MiB or smaller` / `Only JPEG, PNG, WebP and GIF images are allowed`.** These are the app's upload rules, working as intended.

**`DB_NAME in .env is "…" but db/schema.sql creates "comp3278_social"`.** Set `DB_NAME=comp3278_social`.

**`db:seed failed: The database already has users`.** The seed only fills an empty schema. Keep existing data, or use `npm run db:reset` only if it is disposable.

**`node: bad option: --env-file` or `SyntaxError` on `scripts/*.ts`.** Your Node is too old. Install Node 22.18+ (24 LTS recommended).

**`.env` not found.** Run `cp .env.example .env` first; the npm scripts load it with `--env-file`.

## Focused database checks

With a disposable database initialized from the schema, set the normal `DB_*`
environment variables and `RUN_DB_TESTS=1`, then run `npm run test:db`. Tests create
and remove their own fixtures without resetting the database. Never point tests
at a shared or production database.

## Updating an existing database

Fresh installs use `db/schema.sql` directly. For the original baseline, apply
`001-self-messages.sql` and `002-image-limit.sql` once first. For the previous
Threadly version those two changes are already installed.

To upgrade threads/comments to unified posts:

1. Stop the app and take a MySQL backup (including data). Verify it restores into
   a separate database/server before upgrading valued data.
2. Run `npm run db:migrate`. It applies `003-unified-posts.sql`, verifies the
   counts of posts, likes and saved links, and only then removes old storage.
3. Build/start the updated application. Root `/threads/{id}` URLs keep their IDs;
   old comment IDs are remapped into the shared post ID space.

MySQL DDL is not transactional. If the migration fails partway through, restore
the backup before retrying; the script refuses an ambiguous partial schema.
`db:reset` is not an upgrade and deletes your data. Local backups belong outside
Git; `.local-backups/` is ignored.

Self-messaging is available from Messages and your own profile. A self-message
is shown once, aligned on the sending side, and has one conversation-list entry.

## Browser acceptance checks

Build and start the app against the same disposable database used by the tests,
for example on port 33379 (`npm run build`, then `npm start -- --port 33379`).
With `RUN_DB_TESTS=1` and the matching `DB_*` environment variables exported, run
`npm run test:browser`. Set `TEST_BASE_URL` if using another address. The default
Playwright configuration uses installed Google Chrome (`channel: "chrome"`).
Tests register/remove synthetic accounts and check session renewal, 10 MiB
uploads, self-messages, private image access, cleanup, and preserved CRUD flows.
Screenshots/traces are local ignored files in `test-results/`.

A test run does not authorize resetting any shared database. See
[validation evidence](docs/VALIDATION.md) for checked environments and limitations.

## Unified conversations and visual behavior

Roots and replies share `posts`; roots have `parent_id=NULL`. Each reply has a
permalink at `/threads/{id}`, ancestor context, direct replies, and the same
edit/like/delete operations. Root topics and parent links are immutable. Private
collections continue saving roots only. Deleted content becomes an anonymous
“Deleted post” placeholder, preserving descendants; account deletion erases that
account's posts while preserving others' replies. These operations release image
references immediately and remove the deleted posts' likes/saved links.

The interface follows the inspected Threads desktop rail, mobile bottom bar,
continuous feed, compact actions, relative timestamps and contextual composers.
Project-specific topics/collections remain functional rather than displaying
unsupported Threads features. Dialog entrances use the measured 200ms ease-in-out
fade and 0.95→1 scale. Counter rolling/colour, menu and exit timings are local
approximations, with reduced-motion support. Messages keep a scrollable history
above a persistent composer. Clipboard sharing copies the current post URL only.
