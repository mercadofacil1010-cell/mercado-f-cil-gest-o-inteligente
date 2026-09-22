import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconType = ComponentType<{ className?: string }>;
export type Tone = "critical" | "warning" | "positive" | "neutral";

export function Metric({ title, value, note, icon: Icon, tone }: { title: string; value: string; note: string; icon: IconType; tone?: string | undefined }) {
  const color = tone === "critical" ? "bg-critical/10 text-critical" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary";
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <strong className="mt-2 block text-2xl font-extrabold">{value}</strong>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${color}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className={`mt-3 text-sm font-medium ${tone === "positive" ? "text-success" : tone === "critical" ? "text-critical" : "text-muted-foreground"}`}>{note}</p>
    </article>
  );
}

export function ChartCard({ title, subtitle, badge, action, children, className }: { title: string; subtitle: string; badge?: string | undefined; action?: ReactNode; children: ReactNode; className?: string | undefined }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5 shadow-card sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="font-extrabold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
        {badge && <span className="shrink-0 rounded-md bg-highlight-soft px-2.5 py-1 text-sm font-bold text-highlight-foreground">{badge}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

export function AlertPill({ label, tone }: { label: string; tone: Tone }) {
  const color = tone === "warning" ? "bg-warning-soft text-warning" : tone === "critical" ? "bg-critical/10 text-critical" : tone === "positive" ? "bg-highlight-soft text-success" : "bg-muted text-muted-foreground";
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1.5 text-center text-xs font-bold ${color}`}>{label}</span>;
}

export function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>;
}

/** Gráfico de colunas simples em CSS, com rótulos no eixo X. */
export function ColumnChart({ data, label, highlightLast = false, height = "h-56" }: { data: Array<{ label: string; value: number; tone?: Tone }>; label: string; highlightLast?: boolean; height?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className={cn("mt-7 flex items-end gap-1.5 sm:gap-3", height)} role="img" aria-label={label}>
      {data.map((item, index) => {
        const color = item.tone === "critical" ? "bg-critical/80" : item.tone === "warning" ? "bg-warning" : highlightLast && index === data.length - 1 ? "bg-primary" : "bg-chart-bar";
        return (
          <div key={`${item.label}-${index}`} className="grid h-full min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2" title={`${item.label}: ${item.value.toLocaleString("pt-BR")}`}>
            <div className="flex items-end"><div className={cn("w-full rounded-t-sm transition hover:bg-primary", color)} style={{ height: `${Math.max(2, Math.round((item.value / max) * 100))}%` }} /></div>
            <span className="truncate text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBar({ label, value, max, detail, muted, tone }: { label: string; value: number; max: number; detail: string; muted?: boolean | undefined; tone?: Tone | undefined }) {
  const color = tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning" : muted ? "bg-chart-bar" : "bg-primary";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate font-semibold">{label}</span><strong className="shrink-0">{detail}</strong></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((value / Math.max(1, max)) * 100)}%` }} /></div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: IconType; title: string; description: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center"><Icon className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
