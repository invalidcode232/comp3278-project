# Project decisions

This file tracks consequential unresolved choices and confirmed decisions.
The stack and working policies in `AGENTS.md` were confirmed by the user on
9 November 2026. Items below are open unless explicitly marked otherwise.
Do not interpret a suggested option as an approved requirement.

## Open decisions

The questions below were carried over from planning before the implementation
baseline was adopted. Inspect the existing code and documentation before treating
them as unanswered implementation questions; existing behavior is evidence, not
automatic confirmation of a product decision.

| ID | Decision needed | Context / effect |
| --- | --- | --- |
| D01 | Confirm final submission deadline, presentation slot, and group responsibilities. | The supplied PDFs do not specify the final deadline or exact presentation slot. Check the course announcements/Moodle and agree ownership with the team. |
| D02 | Confirm delivery order and whether any draft features should be deferred. | The baseline includes accounts, threads, comments, collections, topics, likes, follows, images, and DMs. No scope reduction has been approved. |
| D03 | Choose `iron-session` or `jose` cookie authentication. | Both are allowed by the feature document. Record session lifetime, logout behavior, and invalidation on account deletion with the choice. |
| D04 | Decide collection visibility. | The draft provides profile-based collection routes but does not clearly specify public versus owner-only reading. Mutations belong to the owner. |
| D05 | Decide whether a thread's topic can be changed after creation. | Exactly one topic is required at creation; editing currently mentions text and image only. |
| D06 | Specify account-deletion effects, especially for conversations and messages. | The draft says account deletion cascades, but the impact on another participant's message history needs an explicit decision. |
| D07 | Define who may start a DM with another user. | The draft specifies one conversation per distinct pair, ordered user IDs, and no read receipts; follower-based or other initiation restrictions are unspecified. |
| D08 | Define access and caching for images attached to private messages. | The draft's public immutable caching instruction conflicts with protecting private attachments. Deduplication may make one image shared by public and private records. |
| D09 | Decide when unreferenced images are deleted. | Images may be shared by profiles, threads, comments, and messages. Removing one reference must not break another. |
| D10 | Set upload and text limits. | Agree supported image types, maximum upload size, and reasonable content limits before implementing validation. |
| D11 | Choose the reproducible local database setup and any hosting approach. | MySQL is agreed. The course requires reproducible running/setup instructions; the supplied documents do not require public deployment. |

## Confirmed baseline — 12 November 2026

The user selected `invalidcode232/comp3278-project` as the implementation baseline,
starting from commit `1e0070b`. Preserve that implementation while incorporating
the project working agreement.

Initial inspection found TypeScript instead of the earlier JavaScript/JSX choice,
and database-backed sessions instead of `iron-session`/`jose`. The existing README
also documents local MySQL and Docker setup. These observations are not a full
implementation review or validation. Reconcile the affected planning questions
before changing those areas; no stack migration is authorized by this transfer.

## Recording resolutions

When a decision is resolved, record the date, chosen behavior, rationale, and who
confirmed it. Distinguish user/team decisions from routine agent implementation
choices. Update affected requirements, code, and documentation together. Keep
current open questions easy to find; do not use this file as a commit diary.
