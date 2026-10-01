import { onionOffset, type OnionDirection } from "@/constants/animation";
import { compositeFrame, presentSprite } from "@/core/composite";
import type { PaintContext } from "@/core/renderer";

/** Ghosts the neighbouring frame in `direction`, composited into `scratch`, at `opacity`. */
export function drawOnion(
  p: PaintContext,
  opts: { direction: OnionDirection; opacity: number },
  scratch: OffscreenCanvas,
): void {
  // Clamped, never wrapped: a ghost past the ends would read as a bug.
  const index = p.doc.frameIndex(p.frameId);
  const frame = p.doc.frames[index + onionOffset(opts.direction)];
  if (!frame) return;

  const source = compositeFrame(p.doc, frame.id, scratch);
  presentSprite(p.ctx, source, p.viewport, p.doc, opts.opacity);
}
