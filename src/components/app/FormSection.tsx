import type { ReactNode } from "react";

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border pb-8 last:border-b-0">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{children}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"w-full px-3 py-2 border border-border bg-background text-sm focus:border-primary focus:outline-none " + (props.className ?? "")} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"w-full px-3 py-2 border border-border bg-background text-sm focus:border-primary focus:outline-none " + (props.className ?? "")} />;
}

export function CheckboxRow({ label, checked, onChange, suffix }: { label: string; checked: boolean; onChange: (v: boolean) => void; suffix?: ReactNode }) {
  return (
    <label className="flex items-center gap-3 p-3 border border-border hover:border-primary cursor-pointer transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary size-4" />
      <span className="text-sm flex-1">{label}</span>
      {suffix}
    </label>
  );
}

export function RadioGroup<T extends string>({ value, onChange, options, name }: { value: T | undefined; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <label key={opt.value} className={"flex items-center gap-2 p-3 border cursor-pointer text-sm " + (active ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50")}>
            <input type="radio" name={name} value={opt.value} checked={active} onChange={() => onChange(opt.value)} className="accent-primary" />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
