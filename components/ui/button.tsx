import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md text-[13px] font-medium leading-none tracking-[-0.005em] transition-[background,border-color,color,box-shadow,transform] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 active:translate-y-[0.5px] border border-transparent [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--blue)] text-white border-[var(--blue)] shadow-[0_1px_2px_rgba(15,112,183,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[var(--blue-ink)] hover:border-[var(--blue-ink)]",
        primary:
          "bg-[var(--blue)] text-white border-[var(--blue)] shadow-[0_1px_2px_rgba(15,112,183,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[var(--blue-ink)] hover:border-[var(--blue-ink)]",
        secondary:
          "bg-white text-[var(--ink)] border-[var(--rule)] shadow-xs hover:border-[#cfd4db] hover:bg-[#fcfcfd]",
        outline:
          "bg-white text-[var(--ink)] border-[var(--rule)] shadow-xs hover:border-[#cfd4db] hover:bg-[#fcfcfd]",
        ghost:
          "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
        dark:
          "bg-[var(--ink)] text-white border-[var(--ink)] hover:bg-[#1a2035]",
        destructive:
          "bg-[var(--red)] text-white border-[var(--red)] hover:bg-[#b02c24]",
        link:
          "text-[var(--blue)] underline-offset-4 hover:underline hover:text-[var(--blue-ink)]",
      },
      size: {
        default: "h-9 px-3.5",
        sm:      "h-8 px-3 text-[12px]",
        lg:      "h-10 px-4 text-[14px]",
        icon:    "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
