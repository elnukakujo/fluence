"use client";

import { useState } from "react";
import InviteMenu from "./inviteMenu";

export default function CollaborateButton({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(!open)}>
        Collaborate
      </button>
      {open && (
        <div className="mt-2">
          <InviteMenu targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
