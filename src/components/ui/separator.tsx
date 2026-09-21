import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

function Separator({
  className,
  orientation = "horizontal",
  tone = "border",
  ...props
}: SeparatorPrimitive.Props & { tone?: "border" | "input" }) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-center",
        tone === "border" ? "bg-border" : "bg-input",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
