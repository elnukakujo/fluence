import { Users } from "lucide-react";

// "Shared" marker for language/lesson cards and headers. `count` = people the owner shares with;
// omit it for content someone shared with you. `partial` marks a language only some of whose
// lessons are shared (distinct from a fully shared language).
export default function SharedBadge({ count, fromOwner = false, partial = false, incoming = false }: { count?: number; fromOwner?: boolean; partial?: boolean; incoming?: boolean }) {
  const word = partial ? "Partial" : "Shared";
  // `incoming`: this (your own) language hosts N lessons other people shared with you
  const label = incoming ? `${count} shared with you` : fromOwner ? "Shared with you" : count ? `${word} · ${count}` : word;
  const title = incoming ? `${count} ${count === 1 ? "lesson was" : "lessons were"} shared with you by others`
    : fromOwner ? "Shared with you by its owner"
    : partial ? `${count ?? ""} ${count === 1 ? "person has" : "people have"} some of your lessons`.trim()
    : count ? `Shared with ${count} ${count === 1 ? "person" : "people"}` : "Shared";
  return (
    <span className="badge w-fit gap-1" title={title}>
      <Users size={12} aria-hidden /> {label}
    </span>
  );
}
