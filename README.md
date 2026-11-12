# COMP3278 Social

A small social web app: threads grouped by topic, comments, likes, follows, saved collections and direct messages, with image uploads stored in MySQL.

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
git clone <repo-url> comp3278-social
cd comp3278-social
npm install
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
| `npm run db:schema` | `scripts/apply-schema.ts` | Runs `db/schema.sql`: `DROP DATABASE IF EXISTS comp3278_social`, `CREATE DATABASE`, then all 12 tables. **Deletes any existing data in that database.** |
| `npm run db:seed` | `scripts/seed.ts` | Inserts the demo data in one transaction. It refuses to run if users already exist. |
| `npm run db:reset` | both, in order | Fresh database with demo data. Safe to run as often as you like. |

Expected output (ends with):

```
Created database comp3278_social with 12 tables: collection_threads, collections, comment_likes, comments, follows, images, messages, sessions, thread_likes, threads, topics, users
Seeded: { users: 7, topics: 5, threads: 20, comments: 40, thread_likes: 71, comment_likes: 49, follows: 15, collections: 3, collection_threads: 12, messages: 15, images: 8 }
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

The seed contains 7 users, 5 topics, 20 threads, 40 comments, 71 thread likes, 49 comment likes, 15 follows, 3 collections (12 saved threads), 15 DMs across 5 conversations, and 8 images in PNG, JPEG and GIF. Some threads and comments are marked "(edited)". Run `npm run db:reset` at any time to restore this state.

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
| Sign up / log in / log out | `/signup`, `/login`, "Log out" in the header |
| Feed: all / following | `/` (tabs "All" and "Following") |
| Topics and their threads | `/topics` → `/topics/[id]` |
| Create a thread (text and/or image, one topic) | "New thread" in the header → `/threads/new` |
| Thread page: like, comment, edit/delete own comments, save to or remove from a collection | `/threads/[id]` |
| Edit / delete your own thread | "Edit" / "Delete" on your thread cards; editing is at `/threads/[id]/edit` |
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
    │   ├── db.ts               # mysql2 pool, withTransaction(), isMysqlError()
    │   ├── queries/            # ALL SQL: one file per entity, named functions
    │   │   ├── users.ts  sessions.ts  images.ts  topics.ts  threads.ts
    │   │   └── comments.ts  likes.ts  follows.ts  collections.ts  messages.ts
    │   ├── auth.ts             # session cookie (httpOnly), getCurrentUser(), requireUser()
    │   ├── upload.ts           # 5 MB limit, file type from magic bytes, SHA-256, dedup
    │   ├── limits.ts           # upload limits shared with the browser check
    │   ├── validate.ts         # form parsing helpers
    │   └── format.ts
    ├── actions/                # Server Actions: validate input → call queries/*
    ├── components/             # One component per file: ThreadCard, ThreadList, ActionForm, Avatar…
    └── app/                    # pages (App Router) + api/images/[id]/route.ts
```

How a request flows: a page (server component) calls `src/lib/queries/*` to read. A form posts to a Server Action in `src/actions/*`, which checks the session, validates input, calls a query function (inside `withTransaction` when two writes must succeed together) and revalidates the page.

### Design notes

- **Sessions.** Login creates a row in `sessions` with a 256-bit random token and an expiry 30 days out, and stores the token in an `httpOnly`, `SameSite=Lax` cookie. Every request looks up the token with `expires_at > UTC_TIMESTAMP()`. Authenticated activity renews the expiry and cookie for 30 days, at most once per 24 hours, through `src/proxy.ts`. An expired session cannot renew. Logging out deletes the row.
- **Passwords** are hashed with bcrypt (cost 10) via `bcryptjs`.
- **Images.** The type is detected from the file's first bytes, not trusted from the browser. Files over 5 MB are refused, in the browser before upload and again on the server. Images are stored once per SHA-256 and served with `Cache-Control: immutable` plus an ETag.
- **Images are never deleted.** One image row can be shared by several users or posts, so deleting a thread leaves its image in place; cleaning those up would need reference counting. Image URLs are not access-controlled either: anyone who knows an image id can load it, including images sent in DMs.
- **Time zone.** All `DATETIME` values are stored in UTC. The pool sets `time_zone = '+00:00'` on every connection, and the server formats times in its local time zone.

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use :::3000`.** Another process is using port 3000. Find it with `lsof -i :3000` and stop it, or run on another port with `npm run dev -- -p 3001` (or `npm start -- -p 3001`).

**`ports are not available` / `port is already allocated` from `docker compose up`.** Something already listens on `DB_PORT`, often a local MySQL on 3306. Keep `DB_PORT=3307` in `.env`, or pick another free port. Check with `lsof -i :3307`.

**`ECONNREFUSED 127.0.0.1:3307` when running `db:reset`.** MySQL isn't up yet. With Docker, wait until `docker compose ps` shows `(healthy)`; the first start takes about 30 seconds. With a local install, check that `DB_PORT` matches your server (`mysql -u root -p -e "SHOW VARIABLES LIKE 'port'"`).

**`Access denied for user 'root'@...`.** `DB_PASSWORD` doesn't match. With Docker, the root password is fixed when the data volume is first created; changing `.env` later has no effect. Run `docker compose down -v` to delete the volume, then `docker compose up -d` again.

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

**`ER_NET_PACKET_TOO_LARGE` / `Got a packet bigger than 'max_allowed_packet' bytes` when uploading.** Images go into `LONGBLOB` columns in one INSERT, so `max_allowed_packet` must be larger than the biggest upload (5 MB). MySQL 8's default is 64 MB, and the Docker service sets `--max-allowed-packet=64M`. If your server has a smaller value:
```sql
SHOW VARIABLES LIKE 'max_allowed_packet';
SET GLOBAL max_allowed_packet = 67108864;   -- 64 MB, lasts until restart
```
To make it permanent, add `max_allowed_packet=64M` under `[mysqld]` in `my.cnf` and restart MySQL.

**`Images must be 5 MB or smaller` / `Only JPEG, PNG, WebP and GIF images are allowed`.** These are the app's upload rules, working as intended.

**`DB_NAME in .env is "…" but db/schema.sql creates "comp3278_social"`.** Set `DB_NAME=comp3278_social`.

**`db:seed failed: The database already has users`.** The seed only fills an empty schema. Use `npm run db:reset`.

**`node: bad option: --env-file` or `SyntaxError` on `scripts/*.ts`.** Your Node is too old. Install Node 22.18+ (24 LTS recommended).

**`.env` not found.** Run `cp .env.example .env` first; the npm scripts load it with `--env-file`.

## Focused database checks

With a disposable database initialized from the schema, set the normal `DB_*`
environment variables and `RUN_DB_TESTS=1`, then run `npm run test:db`. Tests create
and remove their own fixtures without resetting the database. Never point tests
at a shared or production database.

## Updating an existing database

Fresh installs use `db/schema.sql`. To preserve existing data, apply numbered
files in `db/migrations/` once, in order, using a MySQL client connected to
`comp3278_social` (for example `mysql ... comp3278_social < db/migrations/001-self-messages.sql`).
Do not run `db:reset` as an upgrade: it deletes data. Back up valued data first.

Self-messaging is available from Messages and your own profile. A self-message
is shown once, aligned on the sending side, and has one conversation-list entry.
