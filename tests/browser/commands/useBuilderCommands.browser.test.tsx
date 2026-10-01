import { useEffect } from "react";
import { expect, test } from "vitest";
import { SpritesheetProvider } from "@/app/SpritesheetProvider";
import type { CommandId, CommandRegistry } from "@/commands/types";
import { useBuilderCommands } from "@/commands/useBuilderCommands";
import { SHARED_KEYS } from "@/constants/shortcuts";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { bindingSignature } from "@/lib/keys";
import { render } from "@test/render";

function Probe({ onRegistry }: { onRegistry: (registry: CommandRegistry) => void }) {
  const registry = useBuilderCommands({ width: 8, height: 8 }, () => {});
  useEffect(() => {
    onRegistry(registry);
  }, [registry, onRegistry]);
  return null;
}

async function builderRegistry(): Promise<CommandRegistry> {
  const sheet = await createSpritesheet({ name: "Keys" });
  let registry: CommandRegistry = {};
  await render(
    <SpritesheetProvider spritesheetId={sheet.id} fallback={null} notFound={null}>
      <Probe
        onRegistry={(next) => {
          registry = next;
        }}
      />
    </SpritesheetProvider>,
  );
  await expect.poll(() => Object.keys(registry).length).toBeGreaterThan(0);
  return registry;
}

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

test("the composer's registry files each command under its own id and binds no chord twice", async () => {
  const registry = await builderRegistry();
  const commands = Object.entries(registry);

  for (const [id, command] of commands) expect(command?.id).toBe(id);
  const chords = commands.flatMap(([, command]) => (command?.keys ?? []).map(bindingSignature));
  expect(chords.length).toBeGreaterThan(0);
  expect(duplicates(chords)).toEqual([]);
});

test("the composer's commands take their keys from SHARED_KEYS, as the pixel editor's do", async () => {
  const registry = await builderRegistry();

  expect(Object.keys(registry).sort()).toEqual(Object.keys(SHARED_KEYS).sort());
  for (const id of Object.keys(registry) as CommandId[]) {
    expect(registry[id]?.keys).toBe(SHARED_KEYS[id as keyof typeof SHARED_KEYS]);
  }
});
