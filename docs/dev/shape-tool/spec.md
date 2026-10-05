# Shape tool

## Problem

The Editor has no way to draw straight lines, rectangles or ellipses. These are basic in every pixel editor, and doing them freehand with the Pencil is slow and imprecise.

## Solution

Add one new Tool, **Shape**. It draws a Rectangle, an Ellipse or a Line from the press point to the release point, with a live preview while dragging. Holding Shift constrains the shape (square, circle, or an 8-direction line). A Fill toggle fills Rectangles and Ellipses solid. Pressing R selects the tool, and pressing R again while it is active cycles through the shapes.

## Behavior

1. Shape appears in the sidebar's "draw" group, directly after the Eraser. Its label is "Shape" and its icon is lucide `Shapes`.
2. Pressing R activates it. Pressing R again while it is active cycles the `Shape` setting Rectangle → Ellipse → Line → Rectangle. Holding R borrows it as a Held tool. All of this comes from the existing `shortcut` / `reselect` / held-key machinery.
3. The options bar shows two settings:
   - **Shape**: a choice of Rectangle / Ellipse / Line. The default is Rectangle.
   - **Fill**: a toggle, off by default, with the key F (a setting command, like the Pencil's mirror on V).
4. Left-drag draws with the Primary color and right-drag with the Secondary color (`host.colors.get(gesture.slot)`).
5. The press point is one corner (Rectangle/Ellipse) or one end (Line). The current pointer point is the opposite corner or end. Both points are inclusive, so the shape's bounding box spans both pixels.
6. Outlines are always 1px.
7. **Rectangle**: the 1px border of the bounding box. With Fill on, every pixel in the box.
8. **Ellipse**: a 1px ellipse inscribed in the bounding box, touching all four sides. It has no gaps and no doubled pixels. With Fill on, the outline plus everything inside it.
   - **How Rectangle and Ellipse are computed (one shared path):** each shape is an "inside" test over the bounding box.
     - Rectangle: every pixel in the box is inside.
     - Ellipse: a pixel is inside when its centre `(x + 0.5, y + 0.5)` satisfies `((px − cx)/rx)² + ((py − cy)/ry)² ≤ 1`. `cx, cy` is the box centre and `rx, ry` are half the box width and height, in pixels, inclusive of both edges. A pixel in the middle row or middle column (centre within half a pixel of the box centre) is always inside, so very flat ellipses such as 8×2 still reach all four sides.
     - Fill on: draw every inside pixel. Fill off (outline): draw the inside pixels that have at least one of their 4 direct neighbours (up, down, left, right) outside the shape.
     - The result is gap-free, symmetric and correct for even sizes. Each pixel is visited once, which satisfies rule 15.
9. **Line**: Bresenham from the press point to the current point (reuse `forEachLinePixel`). Line ignores Fill. The Fill toggle stays visible while Line is chosen.
10. **Shift with Rectangle/Ellipse**: the box becomes a square. It stays anchored at the press point, its side is the larger of the two drag extents, and it grows in the direction of the drag.
11. **Shift with Line**: the end snaps to the nearest of 8 directions (horizontal, vertical, 45° diagonals). It keeps the larger extent; for a diagonal, both extents become the larger.
12. Shift is read from each pointer sample (`gesture.modifiers.shift`). Pressing or releasing Shift mid-drag takes effect on the next pointer move. There is no instant redraw on the key event.
13. **Live preview**: on each pointer move the tool reverts the surface (`surface.revert()`), redraws the whole shape from the press point to the current point, and commits its dirty rect. The user sees real pixels on the Cel. The press-to-release drag is one Stroke and one undo step.
14. A click with no drag draws the single pixel under the pointer, with any shape.
15. Each pixel is written at most once per redraw. With a semi-transparent color, overlapping writes would otherwise blend twice (for example the ellipse's symmetric quadrants on small sizes, or the outline and fill together).
16. Pixels outside the Canvas are clipped (`writePixel` already skips them). Dragging past the edge works and only the in-bounds part is drawn.
17. Drawing on a locked or hidden layer behaves as it does for the Pencil, because the host decides editability.
18. Switching tools mid-drag (for example releasing a held R) keeps what is drawn so far. This matches the Pencil. Nothing extra is required.

## Decisions

- **One tool with a shape choice**, not three tools. This was the user's request, and it costs one key (R) plus the existing `reselect` cycling.
- **Preview by revert-and-redraw on the Cel**, not an overlay. It shows true pixels, the Stroke stays one undo step, and the code is less. The select tool already uses `surface.revert()` this way.
- **Fill uses the outline's color.** A secondary-color fill was rejected: more code and less predictable.
- **1px only, no brush size.** Thick ellipses look poor in pixel art and add stamping complexity. Mirroring isn't offered either.
- **Shift is not re-applied on the key event.** Tools don't receive key events. Adding a host key hook was rejected as medium cost for little gain.
- **Ellipse by inside test plus 4-neighbour boundary, not the midpoint ellipse algorithm.** It is one code path shared with Rectangle and about 15 lines, it can't double-write, and it handles even sizes for free. The curve may differ slightly from Aseprite's; that is accepted for v1. The middle row and column are forced inside because the pure centre test leaves flat even-height ellipses (8×2) one pixel short of the box's sides; don't remove that rule.
- **Line ignores Fill and the toggle stays visible.** The settings framework has no conditional visibility, and the user picked the simplest option.

## Context

- Tool contract: `src/framework/tool.ts` (`defineTool`, `shortcut`, `reselect`, `settings`, `continuous`). Host contract: `src/framework/host.ts` (`Gesture.modifiers.shift`, `Surface.revert/commit/buffer`).
- Settings helpers: `src/framework/settings.ts`. Use `choice()` for Shape (with `labels`) and `toggle()` for Fill (with a `command` whose id is like `tool.toggleFill` on key `f`). Check that F and R are free; they are at the time of writing.
- Registry: add `shapeTool` to `TOOL_LIST` in `src/tools/index.ts` after `eraserTool`. The tool lives in `src/tools/shape/` as two files: `tool.ts`, and `shapes.ts` (pure geometry, imported by the unit tests). Tools own their state: no tool-specific code in stores, renderer or host.
- Pixel writing: `writePixel` and `rectUnion` in `src/tools/shared/paint.ts`, and `forEachLinePixel` in `src/core/pixels.ts`. `continuous: true`, because the drag updates the shape.
- The press point must be remembered between `onPointerDown` and `onPointerMove`. Keep it in module state, set on pointer down. There's no need for `onActivate` cleanup, because every gesture starts with a pointer down.
- Model on the Pencil (`src/tools/pencil/tool.ts`) and on the select tool's use of `revert()` (`src/tools/select/tool.ts`).
- Update the glossary in `CONTEXT.md`: add Shape to the **Tool** list.

## Testing

- **Unit tests** (`tests/unit/tools/`) for the pure geometry:
  - Rectangle outline and filled pixel sets.
  - Ellipse outline: symmetric, touches all four sides of the box, no gaps (8-connected), no duplicates. Filled ellipse.
  - Degenerate boxes: 1×1, 1×N, 2×2.
  - Shift constraints: square/circle box in all four drag directions; line snapping to each of the 8 directions.
- **Browser tests** (`tests/browser/tools/shape.browser.test.tsx`, following `pencil.browser.test.tsx`):
  - R selects the tool and R again cycles the shape.
  - F toggles Fill.
  - A drag draws the expected pixels for each shape. Moving back shrinks the preview, so earlier preview pixels don't remain.
  - One undo removes the whole shape.
  - Right-drag uses the Secondary color.
  - Shift-drag gives a square.
- Add a Shape row to `TOOLS` in `tests/browser/tools/tool-matrix.browser.test.tsx`. The table is written out by hand on purpose, and the row's option columns may need a new one for shape/fill.

## Out of scope

- Brush thickness, mirroring.
- Draw from center (Alt).
- 2:1 isometric line snapping.
- Fill in the Secondary color.
- Instant redraw when Shift changes mid-drag.
- Hiding Fill when Line is chosen.
