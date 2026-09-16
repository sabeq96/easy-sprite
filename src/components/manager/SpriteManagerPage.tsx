import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ROUTES } from "@/constants/routes";
import { createSprite, listSprites } from "@/db/repositories/sprites";

// Minimal library so the editor is reachable; phase 9 replaces this with the full manager.
export function SpriteManagerPage() {
  const sprites = useLiveQuery(() => listSprites(), []);
  const navigate = useNavigate();

  const create = async () => {
    const sprite = await createSprite();
    navigate(ROUTES.sprite(sprite.id));
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sprites</h1>
        <Button onClick={create}>
          <Plus />
          New sprite
        </Button>
      </div>

      {sprites?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No sprites yet</EmptyTitle>
            <EmptyDescription>Create one to start drawing.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={create}>
              <Plus />
              New sprite
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {sprites?.map((sprite) => (
            <li key={sprite.id}>
              <Card>
                <CardContent className="p-3">
                  <Link className="text-sm font-medium" to={ROUTES.sprite(sprite.id)}>
                    {sprite.name}
                  </Link>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {sprite.width}×{sprite.height} · {sprite.frames.length} frames
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
