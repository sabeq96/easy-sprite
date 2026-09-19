import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The app's island surface. Every floating bar, sidebar and docked panel sits on one, so the
 * chrome is defined here instead of being retyped at each use site — which is how the borders
 * and ring/shadow treatments drifted apart in the first place.
 *
 * Pass layout (flex, gap, padding, sizing) through `className`; colour, radius, elevation and
 * the hairline belong to the variant and should never be overridden inline.
 */
const panelVariants = cva("rounded-xl", {
  variants: {
    variant: {
      /** Raised chrome: toolbars, sidebars, docked panels — the things that float above a page. */
      primary: "bg-card shadow-sm ring-1 ring-foreground/5",
      /** Recessed surface that content sits *on*, such as a work area behind draggable pieces. */
      secondary: "bg-muted/30 ring-1 ring-foreground/5",
    },
  },
  defaultVariants: { variant: "primary" },
});

export type PanelProps = useRender.ComponentProps<"div"> & VariantProps<typeof panelVariants>;

export function Panel({ className, variant, render, ...props }: PanelProps) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">({ className: cn(panelVariants({ variant }), className) }, props),
    render,
    state: { slot: "panel", variant: variant ?? "primary" },
  });
}
