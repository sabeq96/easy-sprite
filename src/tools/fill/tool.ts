import { Blend, PaintBucket, type LucideIcon } from "lucide-react";
import { floodFill } from "@/core/pixels";
import { defineTool } from "@/framework/tool";
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
}: FillSpec<Id>) {
  return defineTool({
    id,
    label,
    icon,
    group: "color",
    shortcut,
    // A drag must not repeat the fill.
    continuous: false,
    options: [],

    onPointerDown(host, { surface, point, slot }) {
      const dirty = floodFill(
        { buffer: surface.buffer(), width: surface.width, height: surface.height },
        point.x,
        point.y,
        host.colors.get(slot),
        { contiguous },
      );

      surface.commit(dirty);
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
