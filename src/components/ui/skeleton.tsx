import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const skeletonVariants = cva("animate-pulse bg-muted", {
  variants: {
    shape: {
      sm: "rounded",
      default: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
  },
  defaultVariants: {
    shape: "default",
  },
})

function Skeleton({
  className,
  shape,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ shape, className }))}
      {...props}
    />
  )
}

export { Skeleton, skeletonVariants }
