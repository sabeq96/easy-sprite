import { TooltipButton } from "@/components/common/TooltipButton";
import { TOOL_ICONS } from "@/components/editor/toolIcons";
import { Separator } from "@/components/ui/separator";
import { shortcutHint } from "@/constants/shortcuts";
import type { ToolId } from "@/constants/tools";
import { TOOLS } from "@/editor/tools";
import { useEditorStore } from "@/stores/useEditorStore";

// Drawing tools first, then fills and sampling, then the selection pair.
const GROUPS: ToolId[][] = [
  ["pencil", "eraser"],
  ["bucket", "fillSimilar", "picker"],
  ["select", "move"],
];

export function ToolSidebar() {
  const toolId = useEditorStore((state) => state.toolId);
  const setTool = useEditorStore((state) => state.setTool);

  return (
    <aside
      aria-label="Tools"
      className="flex flex-col items-center gap-1 rounded-xl bg-card py-2 shadow-sm ring-1 ring-foreground/5"
    >
      {GROUPS.map((group, index) => (
        <div key={group[0]} className="flex flex-col items-center gap-1">
          {index > 0 && <Separator className="my-1 w-6" />}
          {group.map((id) => {
            const Icon = TOOL_ICONS[id];
            const isActive = toolId === id;

            return (
              <TooltipButton
                key={id}
                label={TOOLS[id].label}
                shortcut={shortcutHint(`tool.${id}`)}
                side="right"
                size="icon"
                variant={isActive ? "secondary" : "ghost"}
                aria-pressed={isActive}
                onClick={() => setTool(id)}
              >
                <Icon />
              </TooltipButton>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
