import {
  Blend,
  Brush,
  Eraser,
  FlipHorizontal,
  Move,
  PaintBucket,
  Pipette,
  SquareDashed,
  type LucideIcon,
} from "lucide-react";
import type { ToolId } from "@/constants/tools";

/** The React-side half of the tool registry: icons cannot live in the React-free core. */
export const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  pencil: Brush,
  mirrorPencil: FlipHorizontal,
  eraser: Eraser,
  bucket: PaintBucket,
  fillSimilar: Blend,
  picker: Pipette,
  select: SquareDashed,
  move: Move,
};
