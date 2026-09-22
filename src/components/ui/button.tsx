import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[0.9375rem] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-action hover:bg-primary-hover active:translate-y-px active:bg-primary-pressed",
        primary: "bg-primary text-primary-foreground shadow-action hover:bg-primary-hover active:translate-y-px active:bg-primary-pressed",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent active:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
        nav: "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";