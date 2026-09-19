import type { RefObject } from "react";
import { useDroppable } from "@dnd-kit/core";
import { BuilderBlock } from "@/components/builder/BuilderBlock";
import { BUILDER_ZOOM } from "@/constants/builder";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { computeBuilderBounds } from "@/export/spritesheetBuilderLayout";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/common/Panel";

export interface BuilderCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  blocks: SpritesheetBlockRecord[];
  docs: Map<string, SpriteDocument>;
  onRemoveBlock: (blockId: string) => void;
}

const MIN_CANVAS_PX = 480;

export function BuilderCanvas({ canvasRef, blocks, docs, onRemoveBlock }: BuilderCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "builder-canvas" });
  const bounds = computeBuilderBounds(blocks, docs);

  return (
    <Panel variant="secondary" className="min-h-0 flex-1 overflow-auto p-6">
      <div
        ref={(node) => {
          setNodeRef(node);
          canvasRef.current = node;
        }}
        data-testid="builder-canvas"
        className={cn(
          "relative rounded-lg border border-dashed transition-colors",
          isOver ? "border-ring bg-accent/20" : "border-border",
        )}
        style={{
          width: Math.max(MIN_CANVAS_PX, bounds.width * BUILDER_ZOOM),
          height: Math.max(MIN_CANVAS_PX, bounds.height * BUILDER_ZOOM),
        }}
      >
        {blocks.map((block) => (
          <BuilderBlock
            key={block.id}
            block={block}
            doc={docs.get(block.spriteId)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        ))}
      </div>
    </Panel>
  );
}
