# Needs-repro: Triage Notes

Use this when a bug can't be reproduced or the report lacks detail. The comment has two jobs:
ask the reporter for exactly what is missing, and **keep what's already known** so the next
triage pass (or the reporter's reply) builds on it instead of starting over.

## Rules

- Start with the one-clause thank-you, then the notes.
- **Established so far** holds facts, not guesses: what the reporter said, what you tried and
  what happened, the environment you tested in. Write down failed attempts too. "Couldn't
  reproduce in Chrome 141 on macOS" saves the next person from repeating it.
- **Still need** is 1–4 specific questions the reporter can answer. Never write "please provide
  more info". Ask for the thing: browser + version, exact steps, a backup JSON.
- Ask for a backup JSON (Settings → Backup → **Export backup**) only when the sprite's contents
  matter. The export holds *everything* in their browser, not just one sprite, so say that out
  loud and let them decide.
- Add the `needs-repro` label.

## On the reporter's reply

Re-read the previous notes, then post an **updated** version of the whole block: move what got
answered into *Established so far* and keep only open questions under *Still need*. Once it
reproduces, drop `needs-repro` and continue normal triage from the verify step.

## Template

```markdown
Thanks for reporting this!

## Triage Notes

**What we've established so far:**

- <fact from the report>
- <what was tried, and the result>

**What we still need from you (@<reporter>):**

- <specific question>
- <specific question>
```

## Example

```markdown
Thanks for reporting this!

## Triage Notes

**What we've established so far:**

- Frames go blank after reordering them in the timeline, and only some of them.
- You're on Safari, macOS (from the issue template).
- I couldn't reproduce it in Chrome 141 or Safari 26 on macOS: dragging frame 3 before
  frame 1 in a 5-frame sprite kept all pixels, including after a reload.

**What we still need from you (@pixel-dan):**

- Does it still happen if you reload the page right after reordering, or only before?
- Roughly how many frames and layers does the sprite have? Do any layers have hidden or
  locked state?
- If you're comfortable sharing it: a backup JSON (Settings → Backup → Export backup). Note
  it includes every sprite in your browser, not just this one.
```
