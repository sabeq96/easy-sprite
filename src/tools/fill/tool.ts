import { Blend, PaintBucket, type LucideIcon } from "lucide-react";
import { floodFill } from "@/core/pixels";
import { commitWrite } from "@/tools/shared/paint";
import { defineTool, type Tool } from "@/framework/tool";
import type { KeyBinding } from "@/lib/keys";

interface FillSpec<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  shortcut: KeyBinding;
  contiguous: boolean;
}

function createFill<const Id extends string>({
  id,
  label,
  icon,
  shortcut,
  contiguous,
}: FillSpec<Id>): Tool<Id> {
  return defineTool({
    id,
    label,
    icon,
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
  icon: PaintBucket,
  shortcut: { key: "b" },
  contiguous: true,
});

export const fillSimilarTool = createFill({
  id: "fillSimilar",
  label: "Fill similar",
  icon: Blend,
  shortcut: { key: "g" },
  contiguous: false,
});
