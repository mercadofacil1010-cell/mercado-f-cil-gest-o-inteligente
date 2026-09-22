import { cn } from "@/lib/utils";

interface BrandLogoProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, inverse = false, className }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="Mercado Fácil">
      <svg className="h-11 w-11 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="10" className={inverse ? "fill-logo-inverse" : "fill-logo"} />
        <path
          d="M10 34V15l8 7 6-8 6 8 8-7v19"
          fill="none"
          className="stroke-logo-accent"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13 28h22M13 34h22" className="stroke-logo-line" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="27.5" y="24.5" width="6" height="6" rx="1" className="fill-logo-highlight" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className={cn("text-[1.15rem] font-extrabold tracking-normal", inverse ? "text-sidebar-foreground" : "text-foreground")}>
            Mercado
          </div>
          <div className="mt-1 text-[0.9rem] font-bold tracking-normal text-primary">Fácil</div>
        </div>
      )}
    </div>
  );
}