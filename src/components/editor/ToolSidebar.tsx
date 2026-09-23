import { Panel } from "@/components/common/Panel";
import { CommandButton } from "@/components/common/CommandButton";
import { TOOL_ICONS } from "@/components/editor/toolIcons";
import { Separator } from "@/components/ui/separator";
import { TOOL_LIST, type ToolId } from "@/editor/tools";
import type { Tool } from "@/editor/tools/types";
import { formatModifier } from "@/lib/keys";

/** Consecutive tools of the same group share a section; the registry order is the sidebar order. */
function groupTools(): Tool<ToolId>[][] {
  const groups: Tool<ToolId>[][] = [];
  for (const tool of TOOL_LIST) {
    const last = groups.at(-1);
    if (last && last[0]?.group === tool.group) last.push(tool);
    else groups.push([tool]);
  }
  return groups;
}

const GROUPS = groupTools();

export function ToolSidebar() {
  return (
    <Panel
      render={<aside aria-label="Tools" />}
      className="flex flex-col items-center gap-1 py-2"
    >
      {GROUPS.map((group, index) => (
        <div key={group[0].id} className="flex flex-col items-center gap-1">
          {index > 0 && <Separator className="my-1 w-6" />}
          {group.map((tool) => {
            const Icon = TOOL_ICONS[tool.id];

            return (
              <CommandButton
                key={tool.id}
                command={`tool.${tool.id}`}
                extraShortcuts={tool.holdKey && [`Hold ${formatModifier(tool.holdKey)}`]}
                side="right"
                size="icon"
              >
                <Icon />
              </CommandButton>
            );
          })}
        </div>
      ))}
    </Panel>
  );
}
