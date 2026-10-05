# Tasks: Shape tool

Spec: [spec.md](spec.md)

## 1. Rectangle, end to end

Shape tool exists with only Rectangle. R selects it. A drag draws a 1px rectangle outline in the slot's color with a live preview (revert and redraw), and one undo removes it. The shared "inside" test plus 4-neighbour outline lives in `src/tools/shape/shapes.ts`.

- [x] `src/tools/shape/{shapes,tool}.ts` added; `shapeTool` in `TOOL_LIST` after `eraserTool`
- [x] Unit test (`tests/unit/tools/shapes.test.ts`): rectangle outline for 1×1, 2×2 and 4×3 boxes, each pixel once
- [x] Browser test (`tests/browser/tools/shape.browser.test.tsx`): R selects Shape; drag draws the rectangle; moving back shrinks the preview with no leftover pixels; one undo clears it
- [x] Shape row added to `tool-matrix.browser.test.tsx`
- [x] `CONTEXT.md` Tool list includes Shape

## 2. Ellipse, Line, Fill

The Shape choice (Rectangle / Ellipse / Line) and the Fill toggle on F are in the options bar. Tapping R while the tool is active cycles the shape. Ellipse uses the same "inside" test path, and Line uses `forEachLinePixel` and ignores Fill.

- [x] Unit test: ellipse outline is symmetric, touches all four sides, has no gaps and no duplicates (1×1, 2×2, 5×3, 8×8); filled ellipse and filled rectangle
- [x] Browser test: R, then R again cycles Rectangle → Ellipse → Line; a drag with Line draws the Bresenham line
- [x] Matrix row updated for the new options

## 3. Shift constraints

Shift-drag makes a square or circle box anchored at the press point (larger extent, grows in the drag direction) and snaps Line to the 8 directions. Shift is read on each pointer move.

- [x] Unit test: constrained box in all four drag directions; line snap to each of the 8 directions
- [x] `npm run` lint, typecheck and the full test suite pass

## Notes

- Tasks 1–3 were built in one pass: splitting the Shape choice across tasks would have meant writing it twice. Committed together.
- Ellipse: the middle row and column always count as inside. Without that, very flat even-height ellipses (for example 8×2) stopped one pixel short of the box's sides.
- Added a Shift-drag Hint ("Square, circle or 8-direction line"), as the tool contract asks for modifier gestures. The Keyboard shortcuts outline test was updated for it, along with the registry, settings and contributed-command tests.
- The browser test also covers F, right-drag and Shift-drag, per the spec's Testing section.
