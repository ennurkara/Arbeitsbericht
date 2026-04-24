import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[var(--rule)] bg-white px-3 text-[13.5px] text-[var(--ink)] tracking-[-0.003em] transition-[border-color,box-shadow] placeholder:text-[var(--ink-4)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--ink)] focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-[3px] focus-visible:ring-[var(--blue)]/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
