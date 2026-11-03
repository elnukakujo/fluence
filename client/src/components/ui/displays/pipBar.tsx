// The 5-pip gauge shared by Score and Difficulty. The exact value shows in a tooltip on hover, keyboard focus or tap,
// and is the gauge's accessible name (the pips alone carry no number).
export default function PipBar({ filled, pip, label, value }: { filled: number; pip: string; label: string; value: string }) {
  return (
    <span role="img" aria-label={`${label}: ${value}`} tabIndex={0}
      className="group relative inline-flex cursor-default items-center gap-0.5 rounded px-0.5 py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`block h-3 w-1 rounded-full ${i < filled ? pip : "bg-border"}`} />
      ))}
      <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {value}
      </span>
    </span>
  );
}
