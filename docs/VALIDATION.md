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
