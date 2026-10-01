<!-- Title: short conventional-commit style, e.g. `feat: add new sprite export option`. Link the issue if there is one: Closes #123 -->

## Summary

<!--
The smallest view that makes the point: pseudocode, a call tree, a component or file tree,
a Mermaid diagram, or a ```diff sketch of what changes. Keep prose brief.
-->

## Evidence

<!-- A screenshot for visual changes; otherwise test output or the exact test that now fails and passes. -->

- **Before:**
  **After:**

## Merge Danger

**Door:** <!-- one-way (hard to undo: data, schema, destructive) or two-way (cheap to revert) -->

**Blast Radius:** <!-- one word, e.g. keyboard, layout, storage -->

<!-- Optional: what could break if this merges. -->

## Checklist

- [ ] `npm run lint`, `npm run build` and `npm run test:coverage` pass
- [ ] Added or updated tests for the change
- [ ] Added a screenshot if the UI changed
- [ ] If stored data changed: added a new `db.version` / bumped the backup format, with a migration test
