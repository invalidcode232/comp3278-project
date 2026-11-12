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
