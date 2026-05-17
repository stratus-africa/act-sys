interface Props { variant: "red" | "amber" | "neutral"; label: string }

export function PrecautionBadge({ variant, label }: Props) {
  const bg = {
    red: "bg-alert-red",
    amber: "bg-alert-amber",
    neutral: "bg-slate-800",
  }[variant];
  return (
    <span className={`px-2 py-1 ${bg} text-white text-[10px] font-bold font-mono tracking-wider uppercase`}>
      {label}
    </span>
  );
}
