# Threadly ER diagram — Chen notation

![Unified posts ER diagram](er-diagram.svg)

Sources: `ch2 - ER-model.pdf` (course notation), `db/schema.sql` (implementation),
and `DECISIONS.md` (product policies). The source PDF is a reference, not a claimed
repository file.

- Rectangles are entities; diamonds are relationships; ellipses are attributes.
- Primary keys are underlined. Dashed ellipses are derived counts.
- An arrow from a relationship points toward its **one** side; plain edges mean
  **many**. Double lines mean total participation; single lines mean partial.
- Recursive roles are named: `parent` / `reply` and `follower` / `followee`.
- Foreign-key columns are represented by relationships rather than duplicated as
  attributes. This is Chen notation, not crow's-foot or UML.

## Entities and relationships

| Relationship | Mapping and participation |
|---|---|
| USER WRITES POST | One user, many posts. POST participation is partial because erased posts have no author; active posts require one. |
| POST REPLIES_TO POST | One immediate parent, many replies. Both roles are partial: roots have no parent, leaves no replies. `parent_id=NULL` identifies roots. |
| POST BELONGS_TO TOPIC | One topic, many posts. Partial across all posts: only roots participate, and every root must have one topic. Replies derive their topic through ancestors. |
| USER LIKES POST | Many-to-many; `post_likes(user_id,post_id)`. |
| POST SAVED_IN COLLECTION | Many-to-many, with `saved_at`; `collection_posts`. Only live roots may be saved by the application. |
| USER OWNS COLLECTION | One owner, many collections; every collection has an owner (total). |
| USER HAS_SESSION SESSION | One account, many sessions; every session has an account (total). |
| USER FOLLOWS USER | Many-to-many with distinct follower/followee roles; self-follow is disallowed. |
| USER SENDS / RECEIVES MESSAGE | One user per role, many messages; both message roles total. The roles may be the same user for self-messages. |
| USER AVATAR IMAGE | Optional image per account; shared image may serve many accounts. |
| POST POST_IMAGE IMAGE | Optional image per active post; shared images may serve many posts. |
| MESSAGE MESSAGE_IMAGE IMAGE | Optional image per message; shared images may serve many messages. |

The seven entities are USER, SESSION, POST, TOPIC, COLLECTION, MESSAGE and IMAGE.
There is no separate COMMENT entity. POST includes `deleted_at`; a tombstone
retains its key/parent/timestamps while author, body and image are erased.
Conditional rules (root-only topics, active-post content, tombstone erasure and
private root-only collections) are documented here and in schema CHECK/application
rules; simple Chen participation lines alone cannot express all of them.

The three many-to-many junctions plus seven entities produce ten relations.
[Relational schema](relational-schema.md) details keys, normalization, constraints
and deletion. No cascaded subtree deletion is implied by REPLIES_TO: its FK is
RESTRICT, and the app erases content instead of physically deleting posts.

## Rendering

`er-diagram.dot` is the editable source; SVG is for inspection and PNG for slides.

```sh
dot -Kneato -Tsvg docs/er-diagram.dot -o docs/er-diagram.svg
dot -Kneato -Tpng docs/er-diagram.dot -o docs/er-diagram.png
```

Pinned positions make role labels and participation edges predictable. Regenerate
both formats whenever relationships or attributes change, then inspect the render.

Topic names can now be introduced by any signed-in user while creating a root
post. This changes the creation workflow, not the ER structure: TOPIC remains
shared vocabulary, and BELONGS_TO still links each root to exactly one fixed
topic. No creator/ownership relationship is introduced.
