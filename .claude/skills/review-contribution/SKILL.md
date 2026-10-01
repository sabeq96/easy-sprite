---
name: review-contribution
description: Review a community pull request to Easy Sprite against the project's architecture, conventions and data-safety rules, then draft kind, actionable maintainer feedback that separates blockers from nits. Use when the user asks to review a PR, look at a contribution, or decide whether a PR is ready to merge.
---

# Review a contribution

Produce a merge decision and a drafted review for a PR — usually from someone who is not the
maintainer and may be contributing to open source for the first time. The goal is a good merge
**and** a contributor who comes back.

## Input

A PR number or link on `sabeq96/easy-sprite`. Use the GitHub MCP tools
(`mcp__github__pull_request_read` for the diff, files, comments and check status) when available;
otherwise `gh pr view` / `gh pr diff` / `gh pr checks`.

## 1. Understand before judging

- Read the PR description and the linked issue. What problem does it solve? Was the approach
  agreed in the issue (CONTRIBUTING asks for that on bigger changes)?
- Read the whole diff once without commenting.
- **Scope check first.** If the PR adds something `docs/README.md` lists as out of scope, or
  contradicts a *Decision log* entry, that is the review — everything else is secondary. Say so
  early and kindly, before the contributor spends more evenings on it.

## 2. Verify it works

Check CI status on the head commit. If CI has not run or you need more confidence, check it out
locally:

```bash
git fetch origin pull/<n>/head:pr-<n> && git checkout pr-<n>
npm ci
npm run lint && npm run build && npm run test:coverage
```

`test:coverage` is what CI runs — it includes the coverage floor from `vitest.config.ts`. Browser
tests need Chromium (`npx playwright install chromium`, or the pre-installed one in cloud
sessions). For UI changes, run the app (`npm run dev`) and try the change yourself, including
keyboard use and dark/light theme.

## 3. Review checklist

Work through these in order; the first sections hold the blockers.

### A. Data safety — blockers
User sprites live only in the user's IndexedDB. A mistake here destroys someone's work.
- **`src/db/db.ts`**: a shipped `db.version(n)` block is never edited. Schema changes add a new
  `db.version(n + 1)` with an `.upgrade()` that migrates existing rows. Is there a unit test in
  `tests/unit/db/` that opens an old-version database and checks the upgrade?
- **Backups** (`src/db/backup.ts`, `BACKUP_FORMAT_VERSION` in `src/constants/storage.ts`): if the
  exported shape changes, the version is bumped **and** older backups still import.
- **Autosave / document runtime** (`src/services/`, `src/core/document*`): any change to when or
  what is saved needs a test proving nothing is lost on reload.
- Pixel data stays raw RGBA — no PNG round-trip for source data (architecture §3).

### B. Architecture — blockers
- Layer boundaries from `docs/architecture.md` §9. `npm run lint` enforces most of them, but check
  the edges lint does not: components reach data **only** through domain hooks
  (`use<Domain>Actions`, live-query hooks); `core/` stays React-free.
- **Pixels never re-render React** (architecture §1). A component reading document fields during
  render instead of via `useDocumentSnapshot`, or state that updates per pixel/pointer-move in a
  React store, is a blocker.
- React Compiler and Base UI traps: `docs/conventions.md` §6c and §6d. Mutating document arrays in
  place, or `<TooltipTrigger render={<Button onClick/>}/>` instead of `<TooltipButton>`, are
  known silent bugs.
- **Where it goes** (`docs/architecture.md` §11): a new editor capability goes in its domain
  module, `src/editor/<domain>/` (its UI, store, commands, hints, painters), and reaches other
  modules only through their `api.ts`; a new tool goes in `src/tools/`. A tool is a folder
  `src/tools/<tool>/` (entry `tool.ts`, declaring its own `icon`) plus one line in `TOOL_LIST`
  in `src/tools/index.ts`, and it reaches the host only through `ToolHost`. A PR that adds
  editor state to `src/stores/`, an editor panel to `src/components/`, or a tool-specific branch
  to a module is in the wrong place.
- A new `api.ts` export is an interface change: is another module really using it? `api.ts`
  exports only what other modules need, never the whole folder.
- New keys go on the command definition itself (`keys` next to `run` in a module's
  `commands.ts`, or in the tool's own definition; the keys both editors share come from
  `SHARED_KEYS` in `src/constants/shortcuts.ts`) and must not conflict — see `docs/shortcuts.md`.

### C. Tests — usually blockers
- Behavior changes come with tests. Location rule (conventions §11): under `tests/`, mirroring
  `src/`; `tests/unit/**` for code without React/DOM/canvas, `tests/browser/**` otherwise.
- Tests assert on the model (`doc.getCel`, store state) where possible; editor tests use
  `@test/editor` helpers; drag tests use `settled()`. Hand-rolled `querySelector` + timing in a
  browser test is a flake waiting for CI.
- Bug fixes: is there a test that fails without the fix?

### D. Conventions — mostly non-blocking
From `docs/conventions.md`: where code goes (§1), size heuristics (§2), naming (§3), no magic
numbers (§4), shadcn-first UI and no restyling `ui/` components (§6b), comments explain *why*
only (§9). Mark these as nits unless they make the code wrong or hard to maintain.

### E. Docs and polish
- Keymap changed → `docs/shortcuts.md` updated. New folder or boundary → architecture §2/§9.
- UI change → screenshot in the PR (CONTRIBUTING requires it).
- **PR title** reads well as a release-note line for users ("Add a line tool", not "refactor
  toolbar state"): GitHub's generated release notes list PRs by title. If it doesn't, suggest a
  better title and offer to change it yourself before merging.

## 4. Classify every finding

- **Blocker** — must change before merge: bugs, data risk, architecture violations, missing tests
  for behavior, scope conflicts.
- **Should** — worth fixing in this PR, but you would merge without it if the contributor is
  stuck.
- **Nit** — style/taste. Prefix with `nit:`. Never block on nits; if there are only nits, approve.

Be honest about uncertainty: "I think this can drop pixels when… — can you check?" beats a
confident wrong claim.

## 5. Draft the review

Tone rules:
- Open with one specific thing the PR does well, then the decision.
- Explain *why* for every blocker, linking the doc section (e.g. `docs/conventions.md` §6c). The
  contributor should learn the rule, not just satisfy you.
- Suggest concrete code (GitHub suggestion blocks) for small fixes.
- Keep the total to what matters: at most ~3 blockers stated clearly beats 15 scattered comments.
  If the PR needs a rethink, say so in the summary rather than line-commenting everything.
- If you would rather fix a nit yourself after merging, say that — it saves them a round-trip.

## Output

```
PR #<n> — <title> by @<author>          CI: <green|red|pending>   Local checks: <result>
Decision: approve | approve with nits | request changes | needs discussion (scope/design)
Summary: <2–3 sentences: what it does, main concern>

Blockers:
  1. <file:line> — <problem> → <fix>  (<doc ref>)
Should:
  …
Nits:
  …

--- draft review summary ---
<text>
--- draft inline comments ---
<file:line>: <text>
```

**Ask before posting.** Submitting a review is public: show the draft and post only on the
maintainer's approval. Post line comments as one pending review and submit it once
(`pull_request_review_write` create → `add_comment_to_pending_review` → `submit_pending`), not a
stream of separate comments. Never merge — merging is the maintainer's call.
