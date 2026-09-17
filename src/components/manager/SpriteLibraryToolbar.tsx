import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpriteLibrary, SpriteSort } from "@/hooks/useSpriteLibrary";

const SORT_LABELS: Record<SpriteSort, string> = {
  updated: "Last edited",
  created: "Newest",
  name: "Name",
};

export interface SpriteLibraryToolbarProps {
  library: SpriteLibrary;
  onCreate: () => void;
}

export function SpriteLibraryToolbar({ library, onCreate }: SpriteLibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-lg font-semibold">Sprites</h1>

      <div className="relative ml-auto">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 w-56 pl-7"
          placeholder="Search sprites"
          aria-label="Search sprites"
          value={library.search}
          onChange={(event) => library.setSearch(event.target.value)}
        />
      </div>

      <Select
        value={library.sort}
        onValueChange={(value) => library.setSort(value as SpriteSort)}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Sort sprites">
          <SelectValue>
            {(value: SpriteSort) => SORT_LABELS[value] ?? "Sort"}
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

      <Button size="sm" onClick={onCreate}>
        <Plus />
        New sprite
      </Button>

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
    </div>
  );
}
