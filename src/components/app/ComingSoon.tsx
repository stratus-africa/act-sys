export function ComingSoon({ module }: { module: string }) {
  return (
    <div className="p-8 max-w-3xl">
      <div className="border-2 border-dashed border-border bg-card p-12 text-center animate-entrance">
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-3">Phase 2</div>
        <h2 className="text-xl font-extrabold tracking-tight mb-2">Coming soon</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{module}</p>
      </div>
    </div>
  );
}