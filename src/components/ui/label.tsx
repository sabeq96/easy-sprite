"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const labelVariants = cva(
  "flex items-center leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {
      size: {
        default: "text-sm",
        sm: "text-xs",
      },
      weight: {
        medium: "font-medium",
        normal: "font-normal",
      },
      gap: {
        default: "gap-2",
        sm: "gap-1.5",
      },
      muted: {
        true: "text-muted-foreground",
        false: "",
      },
      field: {
        true: "group/field-label peer/field-label w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      weight: "medium",
      gap: "default",
      muted: false,
      field: false,
    },
  }
)

function Label({
  className,
  size,
  weight,
  gap,
  muted,
  field,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants({ size, weight, gap, muted, field, className }))}
      {...props}
    />
  )
}

export { Label, labelVariants }
