# Validation evidence

## 12 November 2026 — organization and documentation

- Installed the committed dependencies with `npm ci`.
- Split the mixed `bits.tsx` helpers into Avatar, Stamp, PostImage, and
  ContentFields; moved ThreadList into its own module and updated imports.
- Added declaration/field contracts and formatted source for readable comments.
- `npm run typecheck` and `git diff --check` pass.
- Checked ER notation against `ch2 - ER-model.pdf` (pages 34, 49, 59, 70):
  entity rectangles, relationship diamonds, attribute ellipses, underlined keys,
  one-side arrows, participation double lines, and named recursive roles.
- A disposable MySQL 8.4 container on localhost:33378 is used for subsequent
  integration checks. It is separate from any existing project database.

Runtime feature acceptance remains pending until the corresponding checks below.

## 12 November 2026 — sliding sessions (D03)

- `npm run typecheck` passes.
- `RUN_DB_TESTS=1` with the disposable database settings and `npm run test:db`
  passes: fresh session, just before/exactly at the daily boundary, two concurrent
  renewals (one winner), expired session, revoked session.
- Browser cookie renewal remains scheduled for the combined workflow check.
- Proxy uses Next.js's Node runtime and response-cookie API:
  <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>.

## 12 November 2026 — self-messaging (D07)

- Applied `001-self-messages.sql` to the disposable baseline without resetting it.
- TypeScript and database checks pass, including two self-messages in order,
  one self-conversation entry, and the latest-message projection.
- Regenerated SVG/PNG from the Chen-notation source. The model needs no new
  relationship: the same user can occupy SENDS and RECEIVES for one message.
- Browser sending-side presentation is covered in the later workflow check.

## 12 November 2026 — image authorization and cleanup (D08/D09)

- TypeScript and MySQL integration tests pass.
- Verified anonymous/outsider denial, sender/recipient access, public avatar
  access, revocation after removing that public reference, rollback preservation,
  concurrent deduplication, account cascade with shared image survival, and
  deletion of bytes after the last reference disappears.
- No new ER entity or attribute: visibility derives from relationships and
  cleanup enforces the disjunction of the four possible reference types.
- HTTP response and browser checks remain in the combined workflow validation.

## 12 November 2026 — 10 MiB images (D10)

- Applied `002-image-limit.sql` without resetting existing data.
- Real MySQL tests accept exactly 10,485,760 bytes and reject one additional byte
  at both the upload helper and database constraint. A spoofed MIME type with
  invalid file bytes is rejected.
- Shared UI validation/hints now use 10 MiB. Server Action body allowance is
  12 MB to accommodate multipart overhead and text fields. The browser boundary
  test also exposed the proxy default limit; `proxyClientMaxBodySize` is now
  raised to 12 MB as well.

## 12 November 2026 — browser acceptance and final documentation

- Production `npm run build` passes with the request proxy.
- `npm run test:browser` passes in installed Google Chrome against the production
  server at localhost:33379 and disposable MySQL at localhost:33378.
- Checked registration, daily cookie renewal (and no immediate second renewal),
  exact 10 MiB multipart upload, single sending-side self-message rendering,
  anonymous/outsider denial (including conditional requests), participant access,
  public-avatar sharing, removal of public access, private collections, fixed
  topics, thread/comment editing, likes, follows, saved-link cascade, and account
  deletion with message/image cleanup. Inspected the self-message screenshot.
- Browser checks found and corrected stale file inputs after successful uploads
  and the proxy's separate default request-body limit. The regression workflow
  includes avatar removal after upload and an exact 10 MiB attachment.
- Additional database checks cover comment-image removal, public thread/comment
  access, unauthorized thread deletion, and thread-image cascade cleanup.
- Completed named declaration, parameter, property, and callback documentation;
  removed the unused generic transaction helper in favor of the image lifecycle
  transaction owner. TypeScript declaration inspection found no missing docs on
  named functions/classes/interfaces/type aliases/property signatures in source.
- Regenerated and visually checked the ER diagram; no new entity/attribute was
  needed for these policies. Cross-relationship access/cleanup rules are explained
  alongside the diagram rather than assigned non-course notation.

## 12 November 2026 — fresh checkout at 94fed09

- Cloned the committed source into a separate temporary directory, with no
  inherited `node_modules`, build output, or environment file.
- Created a local `.env` for the disposable MySQL 8.4.13 container, then ran
  `npm ci`, `npm run db:reset`, and `npm run build`: all passed.
- Seed result: 7 users, 5 topics, 20 threads, 40 comments, 71 thread likes,
  49 comment likes, 15 follows, 3 collections, 12 saved links, 15 messages,
  and 8 deduplicated images.
- Ran database tests against the fresh schema: five policy subtests passed
  (six tests including the enclosing test). Started its production build and
  reran the browser acceptance workflow: passed.
- Earlier runs verified both preserving migrations against the old baseline.
  Fresh installation and upgrading existing schema are therefore both covered.
- Environment: macOS, Node 24.12.0, Docker MySQL 8.4.13, installed Google Chrome.
  A separately installed native MySQL server and other operating systems were
  not tested; their setup instructions remain supported but unverified here.
- Tests used only the disposable database. No existing group database was
  migrated or reset. Temporary servers/container/checkouts were removed afterward.

## 12 November 2026 — animated counters and like feedback

- Added a reusable directional counter to post/reply likes, reply totals, and
  profile follow counts. Like controls update optimistically, serialize pending
  clicks, expose pressed state, and roll back with an announced error on failure.
- Type checking and production build passed. Browser acceptance passed against
  the running local app using disposable synthetic accounts, with cleanup.
- Added browser checks for liked colour/pressed state, increment direction,
  reduced-motion animation suppression, unlike, transport-error rollback, and
  successful retry. Visually inspected the captured liked state.
- The first run's failure was a test selector matching Next.js's route announcer
  as well as the intended error alert; scoped the selector and reran successfully.
- Counter timing is an approximation. Safari Personal reference inspection
  verified composer entrance keyframes, but did not isolate active counter
  keyframes; do not claim exact motion parity. No Threads posts or likes were
  changed by this inspection.
- No database schema change is included; unified posts/replies and the larger
  visual refactor remain pending as recorded in DECISIONS.md.

## 12 November 2026 — unified posts and visual refactor

- Replaced separate thread/comment storage with posts, recursive parent links,
  post_likes and collection_posts. Roots retain their existing IDs; migrated
  replies receive IDs above the former root maximum.
- Restored a local database backup into disposable MySQL and verified the
  preserving migration: 61 posts, 125 likes and 13 saved links. Fixed a legacy
  foreign-key-name collision discovered during this rehearsal.
- Fresh schema and seed pass: 10 tables, 20 roots, 40 replies (including a reply
  to a reply), 120 likes, 7 users, 5 topics, 15 follows, 3 collections, 12 saved
  links, 15 messages and 8 images. All seven database tests pass.
- Type checking, production build and browser acceptance pass. Browser coverage
  includes nested creation/editing, ancestor context, deleted placeholders,
  surviving descendants after account deletion, private root saves, ownership,
  image visibility, sessions, optimistic like rollback and reduced motion.
  One final invocation omitted the test safety flag and stopped before mutations;
  the corrected invocation passed.
- Visually checked desktop and 390px/320px screenshots, including nested replies
  and the persistent message composer; checked horizontal overflow on main routes.
  Composer entrance matches measured Safari reference values; counter, menu and
  exit timing remain approximations. No external Threads content was modified.
- Updated relational schema, representative SQL and Chen ER source/SVG/PNG.
  Rendered with Graphviz neato and inspected the result; Graphviz falls back to
  straight relationship edges where its node margins touch.
- Stopped the real local app, made a fresh restricted-permission ignored backup,
  and migrated its existing database successfully without resetting it: all
  61 posts, 125 likes and 13 saved links preserved. Restarted the production app
  at http://127.0.0.1:3000 and verified a successful home-page response.

## 12 November 2026 — user-created topics and screen polish

- Inspected the live Threads composer in Safari Personal: inline author/topic
  input, anchored scrollable suggestions, and “+ Tag new topic” for unmatched
  labels. Cleared the inspection text and closed the composer without posting.
- Topic creation reuses the existing table and unique name key; no migration or
  database reset is required. The five example topics remain valid. Updated the
  working agreement, decisions, schema notes, representative SQL and ER mapping.
  Entity relationships and rendered diagrams are unchanged by this workflow.
- Fresh disposable MySQL schema/seed pass. All eight database tests pass,
  including concurrent case-variant topic reuse, literal substring matching,
  whitespace/length/control-character validation, and rollback after failed post
  creation. Existing session, image, ownership and nested-post tests still pass.
- Production build/type checking pass. Both browser workflows pass: custom topic
  creation, case-insensitive reuse, directory filtering, unchanged topics after
  forged edit input, keyboard suggestions, nested replies, deletion, privacy,
  uploads, and the existing counter/rollback checks.
- Visually inspected feed, composer, topics, profile, collections, messages,
  settings, authentication and confirmation views. Screen checks cover desktop,
  390px and 320px widths, including all primary routes and no horizontal overflow.
  Added checks for suggestion-panel bounds, initial composer/confirmation focus,
  nested Escape dismissal, password reveal and cancellation without deletion.
- Visual inspection caught and fixed browser-default dialog width clipping and
  suggestion overflow at narrow widths, missing topic/count separation, and
  confirmation positioning. Avatar uploads now use a styled chooser with preview.
- All mutations during validation used disposable synthetic accounts/seed data
  in a separate MySQL container; the existing local user database was not reset.
