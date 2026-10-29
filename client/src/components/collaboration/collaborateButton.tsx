"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import InviteMenu from "./inviteMenu";

export default function CollaborateButton({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        Collaborate
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <InviteMenu targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
        </div>,
        document.body,
      )}
    </>
  );
}
