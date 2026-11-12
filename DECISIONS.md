# Project decisions

## Authority and implementation status

On 12 November 2026, the user selected `invalidcode232/comp3278-project` at commit
`1e0070b` as the implementation baseline, then confirmed the decisions below in
a one-by-one discussion. These decisions supersede conflicting details in the
earlier Google Doc proposal linked from `AGENTS.md`.

This record distinguishes agreed behavior from the inspected baseline. The
baseline observations come from source/schema review, not runtime validation.
Implementation was authorized subsequently. The checklist below records progress;
validation evidence is in `docs/VALIDATION.md`. Approval alone is not completion.

## Confirmed decisions — 12 November 2026

All decisions in this table were confirmed by the user. D01 was explicitly
skipped, rather than resolved with invented dates or responsibilities.

| ID | Decision | Rationale / intent | Baseline and remaining work |
| --- | --- | --- | --- |
| D01 | Skip logistics in this decision exercise. | The user said there was no need to discuss them. | No deadline, presentation slot, or responsibility allocation is established by this record. |
| D02 | Keep the current feature scope. | Build on the existing application without deferring feature groups. | Accounts/profiles, threads, comments, likes, follows, collections, topics, images, and DMs have code in the baseline. Verify their behavior rather than treating their presence as acceptance evidence. |
| D03 | Keep database-backed sessions. Use a 30-day inactivity expiry; authenticated activity renews database expiry and cookie lifetime at most once daily. | Preserve the existing authentication model while allowing active users to stay signed in without a write on every request. | Implemented daily-throttled renewal in the request proxy and conditional SQL. Database boundary/concurrency checks and browser cookie renewal checks pass. Preserve logout of the current session and deletion of all sessions when the account is deleted. |
| D04 | Keep collections private. | Retain owner-only access. | Already enforced in the inspected read and mutation paths. No policy change needed. |
| D05 | Keep each thread's topic fixed after creation. | Retain the existing editing scope. | Baseline edit operations update text/image only. No policy change needed. |
| D06 | Keep the current account-deletion cascade, including both sides' DM history. | Retain the simpler deletion model. | Original baseline cascaded authored content and its descendants. Superseded for posts by the later unified-conversation decision below: erase owned posts while preserving descendants. Sessions, likes, follows, collections and both DM directions still cascade. D09 governs unreferenced-image cleanup. |
| D07 | Any signed-in user may message any user, including themselves. Self-messages appear once, on the sending side only. | Retain unrestricted DMs while adding self-messaging. | Self-messaging is implemented in schema/actions/pages, with received-branch exclusion in conversation queries. A non-destructive migration removes the old constraint. Database checks verify single entries and message ordering. No read receipts or message-request workflow is added. |
| D08 | Require participant access to DM-only images. Images also used publicly remain public. Caching must respect permissions. | Protect private attachments without hiding images that have a public reference. | Implemented reference/participant authorization before conditional response handling, with private no-store caching. Database visibility and browser/HTTP access checks pass. An image's content hash or deduplication does not itself grant access. |
| D09 | Delete images immediately when their last reference is removed. | Reclaim unused image data while preserving shared images. | Implemented cleanup of all reference types (now avatars, unified posts, and messages) within serialized image transactions, including replacement and deletion cascades. Database checks cover sharing, rollback, concurrent deduplication, and final-reference deletion. |
| D10 | Increase the image upload limit to 10 MiB; keep other limits and supported formats unchanged. | Allow larger image uploads without changing text/profile limits. | Implemented a 10 MiB cap in server/browser validation and the schema, with a preserving migration for existing databases. Server Action and proxy request allowances are 12 MB for multipart overhead. |
| D11 | Keep both local MySQL and Docker MySQL setup; run locally. | Preserve both existing setup options without adding hosted deployment. | Both paths remain documented. A fresh checkout was installed, seeded, built, and browser-tested against disposable Docker MySQL 8.4.13 over local TCP; a separate native OS MySQL installation was not tested. Database schema/reset commands recreate the database and must not be run against data that must be preserved. |

## Adopted technical baseline

- Next.js App Router with TypeScript/TSX, MySQL, raw SQL through `mysql2/promise`,
  Tailwind CSS, Node.js database routes, and `bcryptjs` password hashing.
- Database-backed sessions replace the earlier `iron-session`/`jose` alternatives.
- User IDs remain UUIDs. Images, threads, comments, collections, and messages
  retain the baseline's auto-increment IDs; no UUID migration is planned.
- Conversations remain derived from sender/recipient rows in `messages`, rather
  than introducing the draft's separate conversations table. D07 now adapts
  this model's self-message exclusions and query assumptions.
- Keep existing routes and features unless a confirmed decision changes them.
  Adoption of the baseline does not establish that every implementation detail
  has passed validation.

## Limits retained under D10

Text lengths below describe the baseline's JavaScript string-length checks
(UTF-16 code units), not a newly imposed character-counting policy.

| Input | Agreed limit |
| --- | --- |
| Image | 10 MiB (10,485,760 bytes); JPEG, PNG, WebP, GIF |
| Thread, comment, DM body | 5,000 after trimming; text and/or image required |
| Bio | 500 after trimming |
| Handle | 3–30 ASCII letters, digits, or underscores |
| Display name | 1–50 after trimming |
| Collection name | 1–50 after trimming; unique per owner |
| Signup password | Retain the baseline minimum of 8; no new application maximum introduced |
| Email | Retain baseline format validation and 255-length cap |

## Implementation and validation progress

- [x] D03: daily-throttled sliding session expiry, including cookie renewal.
- [x] D07: self-messaging across schema, actions, queries, and UI.
- [x] D08: private-image authorization and permission-aware caching.
- [x] D09: immediate cleanup of images with no remaining references.
- [x] D10: consistent 10 MiB upload limits and request overhead allowance.
- [x] Verify preserved behavior through database and browser checks (D02/D04–D06).
- [x] Fresh-checkout installation, schema/seed, build, database checks, and browser
  acceptance against Docker MySQL 8.4.13 over local TCP (D11). Native OS MySQL
  installation remains an environment-specific verification limitation.

All agreed implementation items above are complete with the recorded checks.
There are no further pending choices from D02–D11; implementation details should follow the confirmed policies.
If a consequential ambiguity arises, record it without silently changing policy.

## Recording later resolutions

Record the date, chosen behavior, rationale, and who confirmed consequential
changes. Keep policy decisions distinct from implementation and validation
status. Synchronize affected documentation when behavior changes; do not claim
completion from approval alone.

## Subsequent UI and conversation decisions — 12 November 2026

- Target a close visual replication of Threads, including counters and colour
  changes. Keep Threadly's existing feature scope rather than adding unsupported
  Threads-only controls. Logged-in Safari Personal is the reference.
- Unify root posts and replies into one entity: roots have a NULL parent and
  replies reference another post. Implemented in `posts`, `post_likes` and the preserving migration; the separate threads/comments tables are removed.
- When deleting a post, keep replies connected under a “Deleted post” placeholder.
  Clear deleted content, author identity and image reference. Implemented for post deletion and owned posts during account deletion, preserving others’ replies. Collections retain their existing root-only scope; saved links and likes on deleted posts are removed. This supersedes the post/comment subtree cascade in D06; both DM directions still cascade.
- Counter feedback is implemented independently through shared UI components:
  200ms directional count movement and 180ms like colour/fill transitions,
  optimistic like updates, failure rollback, and reduced-motion support.
  These counter timings approximate the reference; they are not verified exact
  Threads timings. Profile follow counts and reply totals reuse the counter.
- Reference inspection measured new-post and expanded-reply dialogs at 620px
  wide with 16px panel corners, a 70%-black backdrop, and 200ms ease-in-out
  opacity 0→1 / scale 0.95→1 entrances. Implemented for new-post and expanded-reply dialogs. Exit/menu motion is an approximation, not claimed exact parity.


The unified model, responsive visual refactor, attachment previews, persistent DM
composer, accessible modal focus handling and motion are implemented. Reference
matching adapts the existing project scope: discovery shows user-created topics, saves
are private/root-only, and there are no nonfunctional repost/activity controls.
Validation and the local migration outcome are recorded in `docs/VALIDATION.md`.

## 12 November 2026 — user-created topics

The user replaced the predefined topic list with user-created labels. Each root
still has exactly one topic, fixed after creation; replies inherit their root’s
topic. During creation, an inline field offers existing labels containing the
entered substring, case-insensitively, and a “Tag new topic” choice.

Implementation choices: normalize NFC, trim/collapse whitespace, allow 1–50 Unicode
code points, and reject control characters. The existing MySQL unique name key
uses case/accent-insensitive comparison, so equivalent labels reuse the first
spelling. Percent/underscore characters are literal search text. New topics have
an empty optional description and are shared vocabulary, without owner controls.
Topic creation commits or rolls back with the post. Existing demo topics remain
valid examples, not an exhaustive list. No physical schema migration is needed.

Safari Personal inspection confirmed the inline author/topic layout, anchored
scrollable suggestions, and “+ Tag new topic” empty-match option. Communities,
member counts and unrelated Threads features are outside this app’s scope.
