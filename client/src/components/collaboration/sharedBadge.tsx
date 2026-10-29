import { Users } from "lucide-react";

// "Shared" marker for language/lesson cards and headers. `count` = people the owner shares with;
// omit it for content someone shared with you.
export default function SharedBadge({ count, fromOwner = false }: { count?: number; fromOwner?: boolean }) {
  const label = fromOwner ? "Shared with you" : count ? `Shared · ${count}` : "Shared";
  const title = fromOwner ? "Shared with you by its owner" : count ? `Shared with ${count} ${count === 1 ? "person" : "people"}` : "Shared";
  return (
    <span className="badge w-fit gap-1" title={title}>
      <Users size={12} aria-hidden /> {label}
    </span>
  );
}
