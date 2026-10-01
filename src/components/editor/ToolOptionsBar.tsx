import { Fragment } from "react";
import type { CommandId } from "@/commands/types";
import { CommandButton } from "@/components/common/CommandButton";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import type {
  ChoiceSetting,
  Setting,
  SwitchSetting,
  ToggleSetting,
} from "@/framework/settings";
import { useToolSettings } from "@/hooks/useToolSettings";
import { getTool } from "@/tools";
import { useEditorStore } from "@/stores/useEditorStore";

type Entry = readonly [key: string, setting: Setting];

/** Settings in declaration order; consecutive toggles of one group share a row and its label. */
interface Row {
  key: string;
  group?: string;
  entries: Entry[];
}

function rowsOf(entries: readonly Entry[]): Row[] {
  const rows: Row[] = [];
  for (const entry of entries) {
    const [key, setting] = entry;
    const group = setting.kind === "toggle" ? setting.group : undefined;
    const last = rows.at(-1);
    if (group !== undefined && last?.group === group) last.entries.push(entry);
    else rows.push({ key, group, entries: [entry] });
  }
  return rows;
}

interface ControlProps<S extends Setting, V> {
  setting: S;
  value: V;
  onChange: (value: V) => void;
}

function ChoiceControl({ setting, value, onChange }: ControlProps<ChoiceSetting, number>) {
  return (
    <div className="flex items-center gap-1.5">
      <Label size="sm" muted>{setting.label}</Label>
      <ToggleGroup
        value={[String(value)]}
        onValueChange={([next]) => {
          if (next) onChange(Number(next));
        }}
        aria-label={setting.label}
      >
        {setting.values.map((option) => (
          <Toggle
            key={option}
            value={String(option)}
            size="sm"
            aria-label={setting.unit ? `${option} ${setting.unit}` : String(option)}
          >
            {option}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** A toggle with a command is that command's button, so its tooltip shows the key. */
function ToggleControl({ setting, value, onChange }: ControlProps<ToggleSetting, boolean>) {
  const Icon = setting.icon;
  if (setting.command) {
    return (
      <CommandButton command={setting.command.id as CommandId} size="icon-xs">
        <Icon />
      </CommandButton>
    );
  }
  return (
    <Button
      size="icon-xs"
      variant={value ? "secondary" : "ghost"}
      aria-label={setting.label}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <Icon />
    </Button>
  );
}

function SwitchControl({ setting, value, onChange }: ControlProps<SwitchSetting, boolean>) {
  return (
    <Label size="sm" muted>
      <Switch checked={value} onCheckedChange={onChange} />
      {setting.label}
    </Label>
  );
}

/** The active tool's settings, each rendered from its kind: the bar knows no setting by name. */
export function ToolOptionsBar() {
  const toolId = useEditorStore((state) => state.toolId);
  const tool = getTool(toolId);
  const { values, set } = useToolSettings(tool);
  const rows = rowsOf(Object.entries(tool.settings ?? {}));

  const control = ([key, setting]: Entry) => {
    const value = values[key];
    switch (setting.kind) {
      case "choice":
        return (
          <ChoiceControl
            key={key}
            setting={setting}
            value={Number(value)}
            onChange={(next) => set(key, next)}
          />
        );
      case "toggle":
        return (
          <ToggleControl
            key={key}
            setting={setting}
            value={value === true}
            onChange={(next) => set(key, next)}
          />
        );
      case "switch":
        return (
          <SwitchControl
            key={key}
            setting={setting}
            value={value === true}
            onChange={(next) => set(key, next)}
          />
        );
    }
  };

  return (
    <Panel className="flex h-9 items-center gap-3 px-3 text-xs">
      <span className="font-medium">{tool.label}</span>
      {rows.length > 0 && <Separator orientation="vertical" className="h-4" />}

      {rows.map((row) =>
        row.group === undefined ? (
          <Fragment key={row.key}>{row.entries.map(control)}</Fragment>
        ) : (
          <div key={row.key} className="flex items-center gap-1">
            <Label size="sm" muted>{row.group}</Label>
            {row.entries.map(control)}
          </div>
        ),
      )}
    </Panel>
  );
}
