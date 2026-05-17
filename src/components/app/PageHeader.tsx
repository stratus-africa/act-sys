import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="border-b border-border bg-card px-8 py-6 animate-entrance">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          {eyebrow && <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 font-mono">{eyebrow}</div>}
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
