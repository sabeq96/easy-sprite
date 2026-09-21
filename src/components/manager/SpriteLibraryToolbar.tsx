import { ChevronDown, LayoutGrid, Plus, Search, X } from "lucide-react";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Library, LibrarySort } from "@/hooks/useLibrary";

const SORT_LABELS: Record<LibrarySort, string> = {
  updated: "Last edited",
  created: "Newest",
  name: "Name",
};

export interface SpriteLibraryToolbarProps {
  library: Library;
  onCreateSprite: () => void;
  onCreateSpritesheet: () => void;
}

export function SpriteLibraryToolbar({
  library,
  onCreateSprite,
  onCreateSpritesheet,
}: SpriteLibraryToolbarProps) {
  return (
    <Panel className="flex flex-wrap items-center gap-2 px-3 py-2">
      <h1 className="text-lg font-semibold">Sprites</h1>

      <div className="relative ml-auto">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 w-56"
          iconStart
          placeholder="Search"
          aria-label="Search library"
          value={library.search}
          onChange={(event) => library.setSearch(event.target.value)}
        />
      </div>

      <Select
        value={library.sort}
        onValueChange={(value) => library.setSort(value as LibrarySort)}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Sort library">
          <SelectValue>
            {(value: LibrarySort) => SORT_LABELS[value] ?? "Sort"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* A split button: the common action stays one click away, and the rarer spritesheet
          sits behind the chevron rather than competing with it for attention. */}
      <ButtonGroup>
        <Button size="sm" onClick={onCreateSprite}>
          <Plus />
          New sprite
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon-sm" aria-label="More ways to create">
                <ChevronDown />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateSpritesheet}>
              <LayoutGrid />
              New spritesheet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      {library.allTags.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1">
          {library.allTags.map((tag) => (
            <Button
              key={tag}
              size="xs"
              variant={library.tag === tag ? "secondary" : "outline"}
              onClick={() => library.setTag(library.tag === tag ? null : tag)}
            >
              {tag}
            </Button>
          ))}
          {library.tag && (
            <Button size="xs" variant="ghost" onClick={() => library.setTag(null)}>
              <X />
              Clear
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
