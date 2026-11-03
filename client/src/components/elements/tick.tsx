import { Check, Minus } from "lucide-react";

// The visual of a checkbox / radio; render it right after an `<input className="tick-input">` (CSS reads :checked / :indeterminate).
export default function Tick({ radio }: { radio?: boolean }) {
  return (
    <span className="tick" data-radio={radio ? "true" : undefined} aria-hidden>
      <Check className="tick-check" size={14} strokeWidth={3} />
      <Minus className="tick-dash" size={14} strokeWidth={3} />
    </span>
  );
}
