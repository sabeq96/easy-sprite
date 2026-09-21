import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="grid h-dvh grid-rows-[3rem_1fr_auto_1.75rem]">
      <Skeleton className="m-2 h-8" shape="lg" />
      <div className="grid min-h-0 grid-cols-[3.25rem_1fr_17rem] gap-2 px-2">
        <Skeleton className="h-full" shape="lg" />
        <Skeleton className="h-full" shape="lg" />
        <Skeleton className="h-full" shape="lg" />
      </div>
      <Skeleton className="m-2 h-20" shape="lg" />
      <Skeleton className="mx-2 mb-2 h-4" shape="sm" />
    </div>
  );
}
