import { floodFill } from "@/editor/pixels";
import { commitWrite } from "@/editor/tools/paint";
import { defineTool, type Tool } from "@/editor/tools/types";
import type { KeyBinding } from "@/lib/keys";

interface FillSpec<Id extends string> {
  id: Id;
  label: string;
  shortcut: KeyBinding;
  contiguous: boolean;
}

function createFill<const Id extends string>({
  id,
  label,
  shortcut,
  contiguous,
}: FillSpec<Id>): Tool<Id> {
  return defineTool({
    id,
    label,
    group: "color",
    shortcut,
    // A drag must not repeat the fill.
    continuous: false,
    options: [],

    onPointerDown(ctx, point) {
      ctx.stroke.touch(ctx.layerId, ctx.frameId);
      const cel = ctx.doc.ensureCel(ctx.layerId, ctx.frameId);

      const dirty = floodFill(
        { buffer: cel.pixels, width: ctx.doc.width, height: ctx.doc.height },
        point.x,
        point.y,
        ctx.color,
        { contiguous },
      );

      commitWrite(ctx, dirty);
    },
  });
}

export const bucketTool = createFill({
  id: "bucket",
  label: "Paint bucket",
  shortcut: { key: "b" },
  contiguous: true,
});

export const fillSimilarTool = createFill({
  id: "fillSimilar",
  label: "Fill similar",
  shortcut: { key: "g" },
  contiguous: false,
});
