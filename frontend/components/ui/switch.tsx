"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="relative inline-flex items-center">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer h-5 w-9 cursor-pointer appearance-none rounded-full border-2 border-transparent bg-input shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary",
        className
      )}
      {...props}
    />
    <span className="pointer-events-none absolute left-1 h-3.5 w-3.5 rounded-full bg-background shadow-lg transition-transform peer-checked:translate-x-4" />
  </div>
))
Switch.displayName = "Switch"

export { Switch }
