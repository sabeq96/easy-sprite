import { TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ROUTES } from "@/constants/routes";

export function EditorLoadError({ message }: { message: string }) {
  return (
    <div className="grid h-dvh place-items-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Could not open this sprite</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={ROUTES.sprites}>Back to sprites</Link>}
          />
        </EmptyContent>
      </Empty>
    </div>
  );
}
