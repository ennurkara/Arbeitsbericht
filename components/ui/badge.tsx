import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-medium border border-transparent whitespace-nowrap leading-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--paper-2)] text-[var(--ink-2)]",
        secondary:
          "bg-[var(--paper-2)] text-[var(--ink-2)]",
        outline:
          "bg-white border-[var(--rule)] text-[var(--ink-2)]",
        destructive:
          "bg-[var(--red-tint)] text-[var(--red)]",
        lager:
          "bg-[var(--green-tint)] text-[var(--green)]",
        reserv:
          "bg-[var(--amber-tint)] text-[var(--amber)]",
        verkauft:
          "bg-[var(--blue-tint)] text-[var(--blue-ink)]",
        defekt:
          "bg-[var(--red-tint)] text-[var(--red)]",
        aus:
          "bg-[var(--paper-3)] text-[var(--ink-3)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean
}

function Badge({ className, variant, withDot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
