---
name: triage
description: Triage Easy Sprite GitHub issues — classify, label, find duplicates, check scope, and draft a friendly maintainer reply. Use when the user says "triage", asks to go through new/open issues, or pastes an issue number or link and wants to know what to do with it.
---

# Triage

Turn an incoming issue into a decision: what it is, which labels it gets, whether it is in scope,
and a drafted reply. The maintainer approves before anything is posted.

## Input

- An issue number or link → triage that one.
- "new issues" / no argument → list open issues with **no labels other than the template's own**
  (`bug`, `enhancement`) and no maintainer comment, oldest first, and triage each.

Use the GitHub MCP tools (`mcp__github__issue_read`, `list_issues`, `search_issues`) when they are
available; otherwise `gh issue view` / `gh issue list`. Repo: `sabeq96/easy-sprite`.

## Steps for each issue

1. **Read it fully** — body, comments, attached screenshots, the reporter's browser/OS.
2. **Classify** into exactly one type:
   | Type | Signal |
   | --- | --- |
   | bug | the app does something other than what it clearly intends |
   | enhancement | new capability or a change to intended behavior |
   | question | "how do I…" — the feature exists (check `docs/shortcuts.md`, the README) |
   | docs | wrong or missing documentation only |
3. **Search for duplicates** — `search_issues` with 2–3 keyword variants, open *and* closed. A
   closed duplicate with a decision ("won't do because…") is the strongest answer you can give.
4. **Check scope** against the project's stated identity before anything else:
   - `docs/README.md` → *Scope* table and the **Explicitly out of scope** line (GIF export, cloud
     sync, collaboration, vector tools, text tool), plus the *Decision log* "Revisit if" column —
     a request that meets a "Revisit if" condition is worth flagging to the maintainer, not closing.
   - README: local-first, no account, keyboard-driven, "for developers who want sprites in their
     game". Anything needing a server or an account is out of scope by construction.
5. **For bugs, assess the report:**
   - Is there a reproduction (steps, or a sprite/backup file)? If not → `needs-repro`.
   - Try to locate the code: use `docs/architecture.md` §2 (folder map) to find the likely module,
     then grep. Name the file(s) in your notes — it makes the fix and a `good first issue` label
     much cheaper.
   - **Data loss or corrupted sprites is always top priority.** Anything touching `src/db/`,
     autosave (`src/services/`), or backup import/export gets flagged at the top of your summary.
   - Browser-specific? Note it (Safari `OffscreenCanvas` and pointer-capture quirks are known
     territory — see the comments in `src/editor/`).
6. **Consider `good first issue`** — only if: the fix is in one or two files you have identified,
   needs no design decision, and has an obvious test location under `tests/`. When suggesting it,
   also draft a short "Where to start" comment naming the files and the test to add.
7. **Security reports posted publicly** — do not discuss details. Draft a reply pointing to
   `SECURITY.md` (private advisory) and recommend the maintainer hide/transfer the content.

## Labels

Use existing repo labels. The standard set:
`bug`, `enhancement`, `question`, `documentation`, `duplicate`, `needs-repro`, `good first issue`,
`help wanted`, `wontfix`, `out of scope`.
If a label you want does not exist, say so and propose creating it — do not invent labels
silently.

## Reply drafting

Tone: warm, brief, specific. This is an off-hours project; the reporter gave their time too.

- Always thank them in one short clause — not a paragraph.
- **Needs repro:** ask for exactly what is missing (steps, browser, a backup JSON from
  Settings → export if the sprite matters). One question list, not an interrogation.
- **Duplicate:** link the original, and say what to do there (👍 it, add their case).
- **Out of scope:** give the reason from the docs in one sentence, and suggest an alternative if
  there is one (e.g. spritesheet PNG + an external tool for GIFs). Closing with a reason is kind;
  leaving it open forever is not.
- **Accepted:** say it's a good idea / confirmed bug, and whether contributions are welcome
  (point to `CONTRIBUTING.md`; for non-trivial features ask the contributor to agree on the
  approach in the issue first).
- Never promise a date.

## Output

For each issue, give the maintainer:

```
#<n> <title>
Type: <bug|enhancement|question|docs>   Priority: <high (data loss / broken core) | normal | low>
Labels: +<add> -<remove>
Duplicate of: #<n> | none found (searched: "<terms>")
Scope: in | out (<reason, doc reference>) | needs your call (<why>)
Likely code: <files>        good first issue: yes/no (<why>)
Action: reply | reply + close (<state_reason>) | reply + label | escalate to you
--- draft reply ---
<text>
```

Then **ask before acting**. Posting a comment, adding labels or closing are public actions: only
do them after the maintainer approves (they may approve all at once). When closing, always set
`state_reason` (`completed`, `not_planned`, or `duplicate`). End every posted comment with the
repo's attribution footer if the session requires one.
